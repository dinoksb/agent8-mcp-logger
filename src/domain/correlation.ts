import type {
  CorrelatedRun,
  ParsedLogEvent,
  RunStatus,
  StageTiming,
} from "./types.js";
import type { CorrelationKeyStats } from "../contracts/report-payload.js";

interface CorrelationAliases {
  requestIdToOperationId: Map<string, string>;
  traceToOperationId: Map<string, string>;
}

function compareTimestamps(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function pickRunPrompt(events: ParsedLogEvent[]): string | undefined {
  return (
    events.find((event) => event.stage === "request" && event.prompt)?.prompt ??
    events.find((event) => event.prompt)?.prompt
  );
}

function pickResultUrl(events: ParsedLogEvent[]): string | undefined {
  const reversed = [...events].reverse();
  const preferredStages = ["completed", "upload", "result_fetch", "post_processing"];

  for (const stage of preferredStages) {
    const url = reversed.find((event) => event.stage === stage && event.url)?.url;
    if (url) {
      return url;
    }
  }

  return reversed.find((event) => event.url)?.url;
}

function pickHttpStatusCode(events: ParsedLogEvent[]): number | undefined {
  // failed stage 이벤트에서 우선 픽업 (4xx/5xx)
  const failedEvent = events.find(
    (e) => e.stage === "failed" && e.httpStatusCode !== undefined
  );
  if (failedEvent?.httpStatusCode !== undefined)
    return failedEvent.httpStatusCode;

  // 마지막으로 나타난 4xx/5xx
  const errorEvent = [...events]
    .reverse()
    .find(
      (e) => e.httpStatusCode !== undefined && e.httpStatusCode >= 400
    );
  if (errorEvent?.httpStatusCode !== undefined)
    return errorEvent.httpStatusCode;

  // 그 외 마지막 상태 코드
  return [...events]
    .reverse()
    .find((e) => e.httpStatusCode !== undefined)?.httpStatusCode;
}

function buildCorrelationAliases(events: ParsedLogEvent[]): CorrelationAliases {
  const requestIdToOperationId = new Map<string, string>();
  const traceToOperationId = new Map<string, string>();

  for (const event of events) {
    if (event.operationId && event.requestId) {
      requestIdToOperationId.set(event.requestId, event.operationId);
    }
    if (event.operationId && event.trace) {
      traceToOperationId.set(event.trace, event.operationId);
    }
  }

  return {
    requestIdToOperationId,
    traceToOperationId,
  };
}

function buildCorrelationKey(
  event: ParsedLogEvent,
  aliases: CorrelationAliases,
): string {
  if (event.operationId) {
    return `operation:${event.operationId}`;
  }

  if (event.requestId) {
    const operationId = aliases.requestIdToOperationId.get(event.requestId);
    if (operationId) {
      return `operation:${operationId}`;
    }
  }

  if (event.trace) {
    const operationId = aliases.traceToOperationId.get(event.trace);
    if (operationId) {
      return `operation:${operationId}`;
    }
  }

  if (event.requestId) {
    return `request:${event.requestId}`;
  }

  if (event.trace) {
    return `trace:${event.trace}`;
  }

  const bucket = new Date(event.timestamp);
  bucket.setSeconds(0, 0);

  return [
    "bucket",
    event.serviceName ?? "unknown-service",
    event.toolFlow,
    event.revisionName ?? "unknown-revision",
    bucket.toISOString(),
  ].join(":");
}

function normalizeRunStatus(value: string | undefined): string | undefined {
  return value?.toLowerCase();
}

function deriveRunStatus(events: ParsedLogEvent[]): RunStatus {
  const hasCompletion = events.some(
    (event) =>
      event.stage === "completed" ||
      (event.stage === "status_poll" &&
        normalizeRunStatus(event.status) === "completed"),
  );
  const hasTerminalFailure = events.some((event) => {
    const normalizedStatus = normalizeRunStatus(event.status);
    return (
      (event.stage === "failed" ||
        event.severity.toLowerCase() === "error" ||
        /fal queue timed out in in_queue/i.test(event.message) ||
        /falqueuetimeouterror/i.test(event.errorMessage ?? "") ||
        normalizedStatus === "failed" ||
        normalizedStatus === "error") &&
      !/primary model failed; starting fallback/i.test(event.message)
    );
  });
  const hasHandoff = events.some((event) =>
    /handing off to status polling/i.test(event.message),
  );

  if (hasCompletion) {
    return "completed";
  }
  if (hasHandoff) {
    return "handed_off";
  }
  if (hasTerminalFailure) {
    return "failed";
  }
  return "in_progress";
}

function buildStageTimings(events: ParsedLogEvent[]): StageTiming[] {
  const grouped = new Map<string, ParsedLogEvent[]>();

  for (const event of events) {
    const bucket = grouped.get(event.stage) ?? [];
    bucket.push(event);
    grouped.set(event.stage, bucket);
  }

  return events
    .map((event) => event.stage)
    .filter((stage, index, allStages) => allStages.indexOf(stage) === index)
    .map((stage, index, orderedStages): StageTiming => {
      const stageEvents = grouped.get(stage) ?? [];
      const startedAt = stageEvents[0]?.timestamp;
      const endedAt = stageEvents.at(-1)?.timestamp;
      const explicitDuration = Math.max(
        0,
        ...stageEvents
          .map((event) => event.durationMs)
          .filter((value): value is number => value !== undefined),
      );
      const nextStage = orderedStages[index + 1];
      const nextStageStart = nextStage
        ? grouped.get(nextStage)?.[0]?.timestamp
        : undefined;
      const inferredDuration =
        startedAt && nextStageStart
          ? new Date(nextStageStart).getTime() - new Date(startedAt).getTime()
          : startedAt && endedAt
            ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
            : undefined;

      return {
        stage,
        startedAt,
        endedAt,
        durationMs:
          explicitDuration > 0 ? explicitDuration : inferredDuration ?? undefined,
        sourceEventIds: stageEvents.map((event) => event.eventId),
      };
    });
}

export interface CorrelationResult {
  runs: CorrelatedRun[];
  keyStats: CorrelationKeyStats;
}

function classifyKeyType(key: string): keyof CorrelationKeyStats {
  if (key.startsWith("operation:")) return "operationId";
  if (key.startsWith("request:")) return "requestId";
  if (key.startsWith("trace:")) return "trace";
  return "bucket";
}

export function correlateEvents(events: ParsedLogEvent[]): CorrelatedRun[] {
  return correlateEventsWithStats(events).runs;
}

export function correlateEventsWithStats(
  events: ParsedLogEvent[],
): CorrelationResult {
  const grouped = new Map<string, ParsedLogEvent[]>();
  const aliases = buildCorrelationAliases(events);

  for (const event of [...events].sort((left, right) =>
    compareTimestamps(left.timestamp, right.timestamp),
  )) {
    const key = buildCorrelationKey(event, aliases);
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  const keyStats: CorrelationKeyStats = {
    operationId: 0,
    requestId: 0,
    trace: 0,
    bucket: 0,
  };
  for (const key of grouped.keys()) {
    keyStats[classifyKeyType(key)] += 1;
  }

  const runs = [...grouped.entries()]
    .map(([groupKey, group]): CorrelatedRun => {
      const eventsInRun = [...group].sort((left, right) =>
        compareTimestamps(left.timestamp, right.timestamp),
      );
      const providers = unique(
        eventsInRun
          .map((event) => event.provider)
          .filter((value): value is NonNullable<typeof value> => value !== undefined),
      );
      const primaryEvent = eventsInRun[0];
      const toolFlow =
        eventsInRun.find((event) => event.toolFlow !== "unknown")?.toolFlow ??
        primaryEvent.toolFlow;
      const operationId =
        eventsInRun.find((event) => event.operationId)?.operationId ??
        (groupKey.startsWith("operation:")
          ? groupKey.slice("operation:".length)
          : undefined);
      const requestId = eventsInRun.find((event) => event.requestId)?.requestId;
      const trace = eventsInRun.find((event) => event.trace)?.trace;
      const totalDurationMs = Math.max(
        0,
        ...eventsInRun
          .map((event) => event.totalDurationMs)
          .filter((value): value is number => value !== undefined),
      );

      return {
        runId:
          operationId ??
          requestId ??
          (groupKey.startsWith("trace:") ? groupKey.slice("trace:".length) : groupKey),
        projectId: primaryEvent.projectId,
        location: primaryEvent.location,
        serviceName: primaryEvent.serviceName,
        revisionName: primaryEvent.revisionName,
        trace,
        toolFlow,
        operationId,
        requestId,
        startedAt: primaryEvent.timestamp,
        endedAt: eventsInRun.at(-1)?.timestamp,
        status: deriveRunStatus(eventsInRun),
        providerChain: providers,
        primaryProvider: providers[0],
        fallbackUsed:
          eventsInRun.some((event) =>
            /primary model failed; starting fallback/i.test(event.message),
          ) || providers.length > 1,
        stages: buildStageTimings(eventsInRun),
        totalDurationMs:
          totalDurationMs > 0
            ? totalDurationMs
            : eventsInRun.at(-1)
              ? new Date(eventsInRun.at(-1)!.timestamp).getTime() -
                new Date(primaryEvent.timestamp).getTime()
              : undefined,
        prompt: pickRunPrompt(eventsInRun),
        resultUrl: pickResultUrl(eventsInRun),
        httpStatusCode: pickHttpStatusCode(eventsInRun),
        evidenceEventIds: eventsInRun.map((event) => event.eventId),
        evidenceRawEntryIds: unique(
          eventsInRun
            .map((event) => event.insertId ?? event.rawEntryId)
            .filter((value): value is string => Boolean(value)),
        ),
      };
    })
    .sort((left, right) => compareTimestamps(left.startedAt, right.startedAt));

  return { runs, keyStats };
}

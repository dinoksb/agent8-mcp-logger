import type {
  ClassificationThresholds,
  CorrelatedRun,
  IncidentReport,
  ParsedLogEvent,
} from "./types.js";

export const defaultThresholds: ClassificationThresholds = {
  generationSlowMs: 30_000,
  analysisSlowMs: 12_000,
  uploadSlowMs: 5_000,
  referenceFetchSlowMs: 3_000,
  missingCompletionMs: 90_000,
};

function buildIncident(
  run: CorrelatedRun,
  severity: IncidentReport["severity"],
  summary: string,
  explanation: string,
  overrides: Partial<IncidentReport> = {},
): IncidentReport {
  return {
    incidentId: `${run.runId}:${severity}:${summary.toLowerCase().replace(/\s+/g, "-")}`,
    runId: run.runId,
    detectedAt: run.endedAt ?? run.startedAt,
    severity,
    summary,
    explanation,
    evidenceEventIds: run.evidenceEventIds,
    ...overrides,
  };
}

function pickBottleneck(run: CorrelatedRun): {
  stage?: CorrelatedRun["bottleneckStage"];
  durationMs?: number;
} {
  const ranked = [...run.stages]
    .filter(
      (stage): stage is typeof stage & { durationMs: number } =>
        stage.durationMs !== undefined,
    )
    .sort((left, right) => right.durationMs - left.durationMs);

  return {
    stage: ranked[0]?.stage,
    durationMs: ranked[0]?.durationMs,
  };
}

export function classifyRuns(
  runs: CorrelatedRun[],
  events: ParsedLogEvent[],
  thresholds: ClassificationThresholds = defaultThresholds,
): { runs: CorrelatedRun[]; incidents: IncidentReport[] } {
  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  const incidents: IncidentReport[] = [];

  const enrichedRuns = runs.map((run) => {
    const runEvents = run.evidenceEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is ParsedLogEvent => event !== undefined);
    const queueTimeout = runEvents.some(
      (event) =>
        /fal queue timed out in in_queue/i.test(event.message) ||
        /falqueuetimeouterror/i.test(event.errorMessage ?? ""),
    );
    const handoff = runEvents.some((event) =>
      /handing off to status polling/i.test(event.message),
    );
    const primaryFailure = runEvents.some((event) =>
      /primary model failed; starting fallback/i.test(event.message),
    );
    const bottleneck = pickBottleneck(run);

    const nextRun: CorrelatedRun = {
      ...run,
      trace: run.trace,
      prompt: run.prompt,
      resultUrl: run.resultUrl,
      evidenceRawEntryIds: run.evidenceRawEntryIds,
      bottleneckStage: bottleneck.stage,
      bottleneckDurationMs: bottleneck.durationMs,
    };

    if (queueTimeout) {
      nextRun.timeoutKind = "fal_in_queue_timeout";
      nextRun.failureKind = "queue_backlog";
      incidents.push(
        buildIncident(
          nextRun,
          "critical",
          "fal queue backlog detected",
          "The run stayed in IN_QUEUE long enough to match the current queue backlog timeout rule.",
          {
            timeoutKind: "fal_in_queue_timeout",
            failureKind: "queue_backlog",
            recommendedAction:
              "Inspect fal queue health, fallback demand, and recent deployment changes.",
          },
        ),
      );
      return nextRun;
    }

    if (handoff && nextRun.status === "handed_off") {
      incidents.push(
        buildIncident(
          nextRun,
          "info",
          "inline wait exceeded",
          "The run exceeded the inline queue wait window and was handed off to status polling instead of failing immediately.",
          {
            recommendedAction:
              "Treat this as a continuation path unless later failure evidence appears.",
          },
        ),
      );
    }

    if (primaryFailure) {
      nextRun.failureKind = "primary_provider_failure";
      incidents.push(
        buildIncident(
          nextRun,
          nextRun.status === "failed" ? "critical" : "warning",
          "primary provider failed before fallback",
          "The primary model failed and the run moved to a fallback path.",
          {
            failureKind: "primary_provider_failure",
            recommendedAction:
              "Compare primary provider stability against fallback success by revision.",
          },
        ),
      );
      return nextRun;
    }

    if (
      nextRun.bottleneckStage === "analysis" &&
      (nextRun.bottleneckDurationMs ?? 0) > thresholds.analysisSlowMs
    ) {
      nextRun.failureKind = "analysis_slow";
      incidents.push(
        buildIncident(
          nextRun,
          "warning",
          "spritesheet analysis is slower than baseline",
          "The analysis stage exceeded the configured threshold and dominated the run duration.",
          {
            failureKind: "analysis_slow",
          },
        ),
      );
      return nextRun;
    }

    if (
      nextRun.bottleneckStage === "upload" &&
      (nextRun.bottleneckDurationMs ?? 0) > thresholds.uploadSlowMs
    ) {
      nextRun.failureKind = "upload_slow";
      nextRun.timeoutKind = "upload_timeout";
      incidents.push(
        buildIncident(
          nextRun,
          "warning",
          "upload stage is slower than baseline",
          "The upload stage exceeded the configured threshold and dominated the run duration.",
          {
            failureKind: "upload_slow",
            timeoutKind: "upload_timeout",
          },
        ),
      );
      return nextRun;
    }

    if (
      nextRun.bottleneckStage === "reference_fetch" &&
      (nextRun.bottleneckDurationMs ?? 0) > thresholds.referenceFetchSlowMs
    ) {
      nextRun.failureKind = "reference_fetch_slow";
      incidents.push(
        buildIncident(
          nextRun,
          "warning",
          "reference fetch is slower than baseline",
          "The reference fetch stage exceeded the configured threshold.",
          {
            failureKind: "reference_fetch_slow",
          },
        ),
      );
      return nextRun;
    }

    if (
      nextRun.status === "in_progress" &&
      (nextRun.totalDurationMs ?? 0) > thresholds.missingCompletionMs
    ) {
      nextRun.failureKind = "missing_completion";
      incidents.push(
        buildIncident(
          nextRun,
          "critical",
          "missing completion event",
          "The run started but no completion or explicit failure was observed within the configured window.",
          {
            failureKind: "missing_completion",
          },
        ),
      );
      return nextRun;
    }

    if (
      nextRun.bottleneckStage === "provider_request" &&
      (nextRun.bottleneckDurationMs ?? 0) > thresholds.generationSlowMs
    ) {
      incidents.push(
        buildIncident(
          nextRun,
          "warning",
          "provider request is slower than baseline",
          "The provider generation stage exceeded the configured threshold and dominated the run duration.",
        ),
      );
    }

    return nextRun;
  });

  return {
    runs: enrichedRuns,
    incidents,
  };
}

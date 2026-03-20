import type {
  HttpStatusSummary,
  ReportPayload,
  ReportRun,
  ReportSummary,
  RunsPayload,
  SnapshotDiagnostics,
} from "../contracts/report-payload.js";
import type {
  CorrelatedRun,
  IncidentReport,
  LogQuery,
  ParsedLogEvent,
  ToolFlowName,
} from "../domain/types.js";

function buildRunsByFlow(
  runs: CorrelatedRun[],
): Partial<Record<ToolFlowName, number>> {
  const counts: Partial<Record<ToolFlowName, number>> = {};

  for (const run of runs) {
    counts[run.toolFlow] = (counts[run.toolFlow] ?? 0) + 1;
  }

  return counts;
}

function buildHttpStatusSummary(
  events: ParsedLogEvent[],
): HttpStatusSummary | undefined {
  const byCode: Record<number, number> = {};
  for (const event of events) {
    if (event.httpStatusCode !== undefined) {
      byCode[event.httpStatusCode] =
        (byCode[event.httpStatusCode] ?? 0) + 1;
    }
  }
  if (Object.keys(byCode).length === 0) return undefined;

  let count2xx = 0;
  let count4xx = 0;
  let count5xx = 0;

  for (const [codeStr, count] of Object.entries(byCode)) {
    const code = Number(codeStr);
    if (code >= 200 && code < 300) {
      count2xx += count;
    } else if (code >= 400 && code < 500) {
      count4xx += count;
    } else if (code >= 500 && code < 600) {
      count5xx += count;
    }
  }

  return {
    "2xx": count2xx,
    "4xx": count4xx,
    "5xx": count5xx,
    byCode,
  };
}

export function buildSummary(
  runs: CorrelatedRun[],
  incidents: IncidentReport[],
  events: ParsedLogEvent[],
): ReportSummary {
  return {
    totalRuns: runs.length,
    completedRuns: runs.filter((run) => run.status === "completed").length,
    failedRuns: runs.filter((run) => run.status === "failed").length,
    handedOffRuns: runs.filter((run) => run.status === "handed_off").length,
    queueTimeouts: runs.filter((run) => run.timeoutKind === "fal_in_queue_timeout")
      .length,
    incidentsBySeverity: {
      info: incidents.filter((incident) => incident.severity === "info").length,
      warning: incidents.filter((incident) => incident.severity === "warning")
        .length,
      critical: incidents.filter((incident) => incident.severity === "critical")
        .length,
    },
    runsByFlow: buildRunsByFlow(runs),
    httpStatusCodes: buildHttpStatusSummary(events),
  };
}

function buildReportRuns(
  runs: CorrelatedRun[],
  events: ParsedLogEvent[],
  includeRawMetadata: boolean,
): ReportRun[] {
  const eventsById = new Map(events.map((event) => [event.eventId, event]));

  return runs.map((run) => ({
    ...run,
    evidenceEvents: run.evidenceEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is ParsedLogEvent => event !== undefined)
      .map((event) => ({
        ...event,
        metadata: includeRawMetadata ? event.metadata : {},
      })),
  }));
}

export function buildReportPayload(input: {
  generatedAt: string;
  coveredFrom: string;
  coveredTo: string;
  query: LogQuery;
  diagnostics: SnapshotDiagnostics;
  events: ParsedLogEvent[];
  runs: CorrelatedRun[];
  incidents: IncidentReport[];
}): ReportPayload {
  const reportRuns = buildReportRuns(
    input.runs,
    input.events,
    input.query.source === "sample",
  );

  return {
    generatedAt: input.generatedAt,
    coveredFrom: input.coveredFrom,
    coveredTo: input.coveredTo,
    query: input.query,
    summary: buildSummary(reportRuns, input.incidents, input.events),
    diagnostics: input.diagnostics,
    runs: reportRuns,
    incidents: input.incidents,
  };
}

export function buildRunsPayload(report: ReportPayload): RunsPayload {
  return {
    generatedAt: report.generatedAt,
    coveredFrom: report.coveredFrom,
    coveredTo: report.coveredTo,
    summary: report.summary,
    diagnostics: report.diagnostics,
    runs: report.runs,
    incidents: report.incidents,
  };
}

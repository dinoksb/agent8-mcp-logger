import type {
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

export function buildSummary(
  runs: CorrelatedRun[],
  incidents: IncidentReport[],
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
    summary: buildSummary(reportRuns, input.incidents),
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

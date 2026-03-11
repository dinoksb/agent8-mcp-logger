import type {
  ReportPayload,
  ReportSummary,
  RunsPayload,
  SnapshotDiagnostics,
} from "../contracts/report-payload.js";
import type {
  CorrelatedRun,
  IncidentReport,
  LogQuery,
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

export function buildReportPayload(input: {
  generatedAt: string;
  coveredFrom: string;
  coveredTo: string;
  query: LogQuery;
  diagnostics: SnapshotDiagnostics;
  runs: CorrelatedRun[];
  incidents: IncidentReport[];
}): ReportPayload {
  return {
    generatedAt: input.generatedAt,
    coveredFrom: input.coveredFrom,
    coveredTo: input.coveredTo,
    query: input.query,
    summary: buildSummary(input.runs, input.incidents),
    diagnostics: input.diagnostics,
    runs: input.runs,
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

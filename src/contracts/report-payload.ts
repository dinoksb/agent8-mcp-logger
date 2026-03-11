import type {
  CorrelatedRun,
  IncidentReport,
  LogQuery,
  ToolFlowName,
} from "../domain/types.js";

export interface IncidentSummary {
  info: number;
  warning: number;
  critical: number;
}

export interface ReportSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  handedOffRuns: number;
  queueTimeouts: number;
  incidentsBySeverity: IncidentSummary;
  runsByFlow: Partial<Record<ToolFlowName, number>>;
}

export interface SnapshotDiagnostics {
  fetchedEntryCount: number;
  parsedEventCount: number;
  recognizedEventCount: number;
  runCount: number;
  fetchStrategy: string;
  notes: string[];
}

export interface ReportPayload {
  generatedAt: string;
  coveredFrom: string;
  coveredTo: string;
  query: LogQuery;
  summary: ReportSummary;
  diagnostics: SnapshotDiagnostics;
  runs: CorrelatedRun[];
  incidents: IncidentReport[];
}

export interface RunsPayload {
  generatedAt: string;
  coveredFrom: string;
  coveredTo: string;
  summary: ReportSummary;
  diagnostics: SnapshotDiagnostics;
  runs: CorrelatedRun[];
  incidents: IncidentReport[];
}

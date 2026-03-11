export type ToolFlowName =
  | "image_asset_generate"
  | "image_variation_generate"
  | "spritesheet_generate"
  | "spritesheet_variation_generate"
  | "unknown";

export type EventStage =
  | "request"
  | "reference_fetch"
  | "reference_analysis"
  | "provider_request"
  | "queue_submit"
  | "queue_wait"
  | "analysis"
  | "background_removal"
  | "post_processing"
  | "status_poll"
  | "result_fetch"
  | "upload"
  | "completed"
  | "failed"
  | "unknown";

export type RunStatus =
  | "completed"
  | "failed"
  | "in_progress"
  | "handed_off"
  | "unknown";

export type TimeoutKind =
  | "fal_in_queue_timeout"
  | "fal_request_timeout"
  | "provider_timeout"
  | "upload_timeout"
  | "unknown_timeout";

export type FailureKind =
  | "queue_backlog"
  | "primary_provider_failure"
  | "fallback_provider_failure"
  | "analysis_slow"
  | "upload_slow"
  | "reference_fetch_slow"
  | "missing_completion"
  | "unknown_failure";

export interface RawLogEntryRecord {
  id: string;
  insertId?: string;
  operationId?: string;
  logName: string;
  timestamp: string;
  receiveTimestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  labels?: Record<string, string>;
  resource: {
    type: string;
    labels: {
      project_id?: string;
      service_name?: string;
      revision_name?: string;
      configuration_name?: string;
      location?: string;
      [key: string]: string | undefined;
    };
  };
  trace?: string;
  spanId?: string;
  source: "cloud_logging_api";
}

export interface ParsedLogEvent {
  eventId: string;
  rawEntryId: string;
  insertId?: string;
  timestamp: string;
  severity: string;
  projectId?: string;
  location?: string;
  serviceName?: string;
  revisionName?: string;
  toolFlow: ToolFlowName;
  message: string;
  stage: EventStage;
  operationId?: string;
  requestId?: string;
  trace?: string;
  spanId?: string;
  provider?:
    | "google"
    | "fal"
    | "google-vertex-ai"
    | "google-api-key"
    | "unknown";
  model?: string;
  phase?: string;
  durationMs?: number;
  totalDurationMs?: number;
  assetType?: string;
  style?: string;
  width?: number;
  height?: number;
  rows?: number;
  cols?: number;
  numImages?: number;
  queuePosition?: number;
  queued?: boolean;
  prompt?: string;
  referenceType?: "spritesheet" | "static";
  fallbackFromModel?: string;
  status?: string;
  url?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface StageTiming {
  stage: EventStage;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  sourceEventIds: string[];
}

export interface CorrelatedRun {
  runId: string;
  projectId?: string;
  location?: string;
  serviceName?: string;
  revisionName?: string;
  trace?: string;
  toolFlow: ToolFlowName;
  operationId?: string;
  requestId?: string;
  startedAt: string;
  endedAt?: string;
  status: RunStatus;
  providerChain: string[];
  primaryProvider?: string;
  fallbackUsed: boolean;
  stages: StageTiming[];
  totalDurationMs?: number;
  bottleneckStage?: EventStage;
  bottleneckDurationMs?: number;
  timeoutKind?: TimeoutKind;
  failureKind?: FailureKind;
  prompt?: string;
  resultUrl?: string;
  evidenceEventIds: string[];
  evidenceRawEntryIds: string[];
}

export interface IncidentReport {
  incidentId: string;
  runId: string;
  detectedAt: string;
  severity: "info" | "warning" | "critical";
  timeoutKind?: TimeoutKind;
  failureKind?: FailureKind;
  summary: string;
  explanation: string;
  recommendedAction?: string;
  evidenceEventIds: string[];
}

export interface LogQuery {
  source: "sample" | "gcp";
  projectId?: string;
  serviceName?: string;
  location?: string;
  from: string;
  to: string;
  limit: number;
  toolFlows: ToolFlowName[];
}

export interface ClassificationThresholds {
  generationSlowMs: number;
  analysisSlowMs: number;
  uploadSlowMs: number;
  referenceFetchSlowMs: number;
  missingCompletionMs: number;
}

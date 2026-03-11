import type {
  EventStage,
  ParsedLogEvent,
  RawLogEntryRecord,
  ToolFlowName,
} from "../domain/types.js";
import { messagePatterns } from "./message-map.js";

const rawPhaseToStage: Record<string, EventStage> = {
  request: "request",
  reference_fetch: "reference_fetch",
  reference_analysis: "reference_analysis",
  provider_request: "provider_request",
  queue_submit: "queue_submit",
  queue_wait: "queue_wait",
  analysis: "analysis",
  background_removal: "background_removal",
  post_processing: "post_processing",
  status: "status_poll",
  result: "result_fetch",
  upload: "upload",
  completed: "completed",
  failed: "failed",
  fallback: "provider_request",
  primary_failure: "provider_request",
};

const prefixedToolFlows: Array<{
  pattern: RegExp;
  toolFlow: ToolFlowName;
}> = [
  {
    pattern: /^\[ImageGeneration\]\s*/i,
    toolFlow: "image_asset_generate",
  },
  {
    pattern: /^\[ImageVariation\]\s*/i,
    toolFlow: "image_variation_generate",
  },
  {
    pattern: /^\[SpritesheetGeneration\]\s*/i,
    toolFlow: "spritesheet_generate",
  },
  {
    pattern: /^\[SpritesheetVariation\]\s*/i,
    toolFlow: "spritesheet_variation_generate",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getPayloadValue(
  payload: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (key in payload) {
      return payload[key];
    }
  }

  return undefined;
}

function deriveToolFlowFromPrefix(message: string): ToolFlowName | undefined {
  return prefixedToolFlows.find((candidate) => candidate.pattern.test(message))
    ?.toolFlow;
}

function deriveMessage(entry: RawLogEntryRecord): string {
  const payload = entry.jsonPayload ?? {};
  return (
    asString(payload.message) ??
    entry.textPayload ??
    asString(payload.event) ??
    "Unknown log message"
  );
}

function deriveToolFlow(
  message: string,
  payload: Record<string, unknown>,
): ToolFlowName {
  const explicitFlow = asString(
    getPayloadValue(payload, "toolFlow", "tool_flow", "flow"),
  );

  if (
    explicitFlow === "image_asset_generate" ||
    explicitFlow === "image_variation_generate" ||
    explicitFlow === "spritesheet_generate" ||
    explicitFlow === "spritesheet_variation_generate"
  ) {
    return explicitFlow;
  }

  const prefixedFlow = deriveToolFlowFromPrefix(message);
  if (prefixedFlow) {
    return prefixedFlow;
  }

  const matched = messagePatterns.find((candidate) =>
    candidate.pattern.test(message),
  );
  if (matched && matched.toolFlow !== "unknown") {
    return matched.toolFlow;
  }

  const lower = message.toLowerCase();
  if (lower.includes("spritesheet variation")) {
    return "spritesheet_variation_generate";
  }
  if (lower.includes("spritesheet")) {
    return "spritesheet_generate";
  }
  if (lower.includes("variation")) {
    return "image_variation_generate";
  }
  if (lower.includes("image")) {
    return "image_asset_generate";
  }

  return "unknown";
}

function deriveStage(
  message: string,
  payload: Record<string, unknown>,
  toolFlow: ToolFlowName,
): EventStage {
  const matched = messagePatterns.find((candidate) =>
    candidate.pattern.test(message),
  );
  if (matched) {
    if (
      matched.toolFlow === "unknown" ||
      matched.toolFlow === toolFlow ||
      toolFlow === "unknown"
    ) {
      return matched.stage;
    }
  }

  const explicitStage = asString(getPayloadValue(payload, "stage", "phase"));
  if (explicitStage && rawPhaseToStage[explicitStage]) {
    return rawPhaseToStage[explicitStage];
  }

  return "unknown";
}

function deriveProvider(
  message: string,
  payload: Record<string, unknown>,
): ParsedLogEvent["provider"] {
  const explicit = asString(getPayloadValue(payload, "provider", "providerName"));
  if (
    explicit === "google" ||
    explicit === "fal" ||
    explicit === "google-vertex-ai" ||
    explicit === "google-api-key"
  ) {
    return explicit;
  }

  const lower = message.toLowerCase();
  if (lower.includes("fal")) {
    return "fal";
  }
  if (lower.includes("vertex")) {
    return "google-vertex-ai";
  }
  if (lower.includes("google")) {
    return "google";
  }

  return explicit ? "unknown" : undefined;
}

export function parseLogEntry(entry: RawLogEntryRecord): ParsedLogEvent {
  const payload = isRecord(entry.jsonPayload) ? entry.jsonPayload : {};
  const message = deriveMessage(entry);
  const toolFlow = deriveToolFlow(message, payload);
  const stage = deriveStage(message, payload, toolFlow);

  return {
    eventId: `event-${entry.id}`,
    rawEntryId: entry.id,
    timestamp: entry.timestamp,
    severity: entry.severity ?? "DEFAULT",
    projectId: entry.resource.labels.project_id,
    location: entry.resource.labels.location,
    serviceName: entry.resource.labels.service_name,
    revisionName: entry.resource.labels.revision_name,
    toolFlow,
    message,
    stage,
    operationId: asString(getPayloadValue(payload, "operationId", "operation_id")),
    requestId: asString(getPayloadValue(payload, "requestId", "request_id")),
    trace: entry.trace,
    spanId: entry.spanId,
    provider: deriveProvider(message, payload),
    model: asString(getPayloadValue(payload, "model", "modelName", "modelPath")),
    phase: asString(getPayloadValue(payload, "phase", "stage")),
    durationMs: asNumber(getPayloadValue(payload, "durationMs", "duration_ms")),
    totalDurationMs: asNumber(
      getPayloadValue(payload, "totalDurationMs", "total_duration_ms"),
    ),
    assetType: asString(getPayloadValue(payload, "assetType", "asset_type")),
    style: asString(getPayloadValue(payload, "style")),
    width: asNumber(getPayloadValue(payload, "width")),
    height: asNumber(getPayloadValue(payload, "height")),
    rows: asNumber(getPayloadValue(payload, "rows")),
    cols: asNumber(getPayloadValue(payload, "cols")),
    numImages: asNumber(getPayloadValue(payload, "numImages", "num_images")),
    queuePosition: asNumber(
      getPayloadValue(payload, "queuePosition", "queue_position"),
    ),
    queued:
      typeof getPayloadValue(payload, "queued") === "boolean"
        ? (getPayloadValue(payload, "queued") as boolean)
        : undefined,
    referenceType: (() => {
      const referenceType = asString(
        getPayloadValue(payload, "referenceType", "reference_type"),
      );
      return referenceType === "spritesheet" || referenceType === "static"
        ? referenceType
        : undefined;
    })(),
    fallbackFromModel: asString(
      getPayloadValue(payload, "fallbackFromModel", "fallback_from_model"),
    ),
    status: asString(getPayloadValue(payload, "status")),
    url: asString(getPayloadValue(payload, "url")),
    errorMessage:
      asString(getPayloadValue(payload, "errorMessage", "error_message")) ??
      asString(isRecord(payload.error) ? payload.error.message : undefined),
    metadata: payload,
  };
}

export function parseLogEntries(entries: RawLogEntryRecord[]): ParsedLogEvent[] {
  return entries.map((entry) => parseLogEntry(entry));
}

export function isRelevantAssetGenerationEvent(event: ParsedLogEvent): boolean {
  return Boolean(
    deriveToolFlowFromPrefix(event.message) ||
      [
        "image_asset_generate",
        "image_variation_generate",
        "spritesheet_generate",
        "spritesheet_variation_generate",
      ].includes(String(event.metadata.toolFlow ?? event.metadata.tool_flow ?? event.metadata.flow ?? "")),
  );
}

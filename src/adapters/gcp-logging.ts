import type { LogQuery, RawLogEntryRecord } from "../domain/types.js";
import { normalizeRawLogEntries } from "../parsing/raw-log-normalizer.js";

const flowSearchTerms: Record<string, string> = {
  image_asset_generate: "ImageGeneration",
  image_variation_generate: "ImageVariation",
  spritesheet_generate: "SpritesheetGeneration",
  spritesheet_variation_generate: "SpritesheetVariation",
};

function buildLoggingFilter(query: LogQuery): string {
  const lines = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${query.serviceName ?? ""}"`,
    `timestamp >= "${query.from}"`,
    `timestamp <= "${query.to}"`,
  ];

  if (query.location) {
    lines.splice(1, 0, `resource.labels.location="${query.location}"`);
  }

  const searchTerms = query.toolFlows
    .map((flow) => flowSearchTerms[flow])
    .filter((value): value is string => Boolean(value));
  if (searchTerms.length > 0) {
    lines.push(
      `(${searchTerms.map((term) => `SEARCH("${term}")`).join(" OR ")})`,
    );
  }

  return lines.join("\n");
}

function toSerializableEntry(entry: any, index: number): unknown {
  const metadata = entry?.metadata ?? {};

  return {
    id: metadata.insertId ?? `gcp-entry-${index + 1}`,
    insertId: metadata.insertId,
    logName: metadata.logName,
    timestamp: metadata.timestamp,
    receiveTimestamp: metadata.receiveTimestamp,
    severity: metadata.severity,
    textPayload: typeof entry?.data === "string" ? entry.data : undefined,
    jsonPayload:
      typeof entry?.data === "object" && entry.data !== null && !Array.isArray(entry.data)
        ? entry.data
        : undefined,
    labels: metadata.labels,
    resource: metadata.resource,
    trace: metadata.trace,
    spanId: metadata.spanId,
  };
}

export async function fetchCloudLoggingEntries(
  query: LogQuery,
): Promise<RawLogEntryRecord[]> {
  if (!query.projectId || !query.serviceName) {
    throw new Error(
      "SNAPSHOT_PROJECT_ID and SNAPSHOT_SERVICE_NAME are required for GCP snapshots.",
    );
  }

  const { Logging } = await import("@google-cloud/logging");
  const logging = new Logging({ projectId: query.projectId });
  const [entries] = await logging.getEntries({
    filter: buildLoggingFilter(query),
    pageSize: query.limit,
    orderBy: "timestamp asc",
  });

  return normalizeRawLogEntries(
    entries.map((entry: any, index: number) => toSerializableEntry(entry, index)),
  );
}

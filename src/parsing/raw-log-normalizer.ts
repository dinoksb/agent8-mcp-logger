import type { RawLogEntryRecord } from "../domain/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function normalizeRawLogEntry(
  input: unknown,
  index: number,
): RawLogEntryRecord {
  const record = getRecord(input) ?? {};
  const resource = getRecord(record.resource);
  const resourceLabels = getRecord(resource?.labels);
  const labels = getRecord(record.labels);
  const jsonPayload = getRecord(record.jsonPayload);

  const id =
    getString(record.id) ??
    getString(record.insertId) ??
    `raw-entry-${index + 1}`;

  return {
    id,
    insertId: getString(record.insertId),
    logName: getString(record.logName) ?? "unknown-log",
    timestamp: getString(record.timestamp) ?? new Date().toISOString(),
    receiveTimestamp: getString(record.receiveTimestamp),
    severity: getString(record.severity),
    textPayload: getString(record.textPayload),
    jsonPayload,
    labels: labels
      ? Object.fromEntries(
          Object.entries(labels).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        )
      : undefined,
    resource: {
      type: getString(resource?.type) ?? "cloud_run_revision",
      labels: resourceLabels
        ? Object.fromEntries(
            Object.entries(resourceLabels).map(([key, value]) => [
              key,
              typeof value === "string" ? value : undefined,
            ]),
          )
        : {},
    },
    trace: getString(record.trace),
    spanId: getString(record.spanId),
    source: "cloud_logging_api",
  };
}

export function normalizeRawLogEntries(
  inputs: unknown[],
): RawLogEntryRecord[] {
  return inputs.map((input, index) => normalizeRawLogEntry(input, index));
}


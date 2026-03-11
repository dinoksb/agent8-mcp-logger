import type { LogQuery, RawLogEntryRecord } from "../domain/types.js";
import { normalizeRawLogEntries } from "../parsing/raw-log-normalizer.js";

const flowSearchTerms: Record<string, string> = {
  image_asset_generate: "[ImageGeneration]",
  image_variation_generate: "[ImageVariation]",
  spritesheet_generate: "[SpritesheetGeneration]",
  spritesheet_variation_generate: "[SpritesheetVariation]",
};

interface LoggingFilterOptions {
  includeLocation: boolean;
  includeMessagePrefixes: boolean;
}

export interface CloudLoggingFetchResult {
  entries: RawLogEntryRecord[];
  strategy: string;
  notes: string[];
}

function buildLoggingFilter(
  query: LogQuery,
  options: LoggingFilterOptions,
): string {
  const lines = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${query.serviceName ?? ""}"`,
    `timestamp >= "${query.from}"`,
    `timestamp <= "${query.to}"`,
  ];

  if (options.includeLocation && query.location) {
    lines.splice(1, 0, `resource.labels.location="${query.location}"`);
  }

  const messagePrefixes = options.includeMessagePrefixes
    ? query.toolFlows
        .map((flow) => flowSearchTerms[flow])
        .filter((value): value is string => Boolean(value))
    : [];
  if (messagePrefixes.length > 0) {
    lines.push(
      `(${messagePrefixes
        .map(
          (prefix) =>
            `textPayload:"${prefix}" OR jsonPayload.message:"${prefix}"`,
        )
        .join(" OR ")})`,
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

async function getEntries(
  logging: {
    getEntries: (
      options: Record<string, unknown>,
    ) => Promise<[any[], unknown, unknown]>;
  },
  query: LogQuery,
  options: LoggingFilterOptions,
): Promise<RawLogEntryRecord[]> {
  const filter = buildLoggingFilter(query, options);
  const [entries] = await logging.getEntries({
    filter,
    pageSize: query.limit,
    orderBy: "timestamp asc",
  });

  return normalizeRawLogEntries(
    entries.map((entry: any, index: number) => toSerializableEntry(entry, index)),
  );
}

export async function fetchCloudLoggingEntries(
  query: LogQuery,
): Promise<CloudLoggingFetchResult> {
  if (!query.projectId || !query.serviceName) {
    throw new Error(
      "SNAPSHOT_PROJECT_ID and SNAPSHOT_SERVICE_NAME are required for GCP snapshots.",
    );
  }

  const { Logging } = await import("@google-cloud/logging");
  const logging = new Logging({ projectId: query.projectId });
  const attempts: Array<
    LoggingFilterOptions & {
      name: string;
    }
  > = [];
  const seenStrategies = new Set<string>();
  const notes: string[] = [];

  function pushAttempt(
    name: string,
    includeLocation: boolean,
    includeMessagePrefixes: boolean,
  ): void {
    if (seenStrategies.has(name)) {
      return;
    }

    seenStrategies.add(name);
    attempts.push({ name, includeLocation, includeMessagePrefixes });
  }

  pushAttempt("service+location+message_prefixes", Boolean(query.location), true);
  pushAttempt("service+message_prefixes", false, true);

  for (const attempt of attempts) {
    const entries = await getEntries(logging, query, attempt);
    console.log(
      `Cloud Logging fetch attempt ${attempt.name} returned ${entries.length} entries.`,
    );

    if (entries.length > 0) {
      if (attempt.name !== "service+location+message_prefixes") {
        notes.push(
          `No entries matched the strict filter, so the fetch retried with ${attempt.name}.`,
        );
      }

      return {
        entries,
        strategy: attempt.name,
        notes,
      };
    }
  }

  notes.push(
    "Cloud Logging returned zero image/spritesheet log entries for every prefix filter tried for this service and time window.",
  );

  return {
    entries: [],
    strategy: attempts.at(-1)?.name ?? "service+message_prefixes",
    notes,
  };
}

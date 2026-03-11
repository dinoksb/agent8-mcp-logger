import { Logging } from "@google-cloud/logging";

const flowSearchTerms: Record<string, string> = {
  image_asset_generate: "[ImageGeneration]",
  image_variation_generate: "[ImageVariation]",
  spritesheet_generate: "[SpritesheetGeneration]",
  spritesheet_variation_generate: "[SpritesheetVariation]",
};

interface InspectConfig {
  projectId: string;
  serviceName: string;
  location?: string;
  from: string;
  to: string;
  limit: number;
  includeMessagePrefixes: boolean;
  toolFlows: string[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() !== "false";
}

function parseToolFlows(value: string | undefined): string[] {
  return (value ?? "image_asset_generate")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildFilter(config: InspectConfig): string {
  const lines = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${config.serviceName}"`,
    `timestamp >= "${config.from}"`,
    `timestamp <= "${config.to}"`,
  ];

  if (config.location) {
    lines.splice(1, 0, `resource.labels.location="${config.location}"`);
  }

  if (config.includeMessagePrefixes) {
    const prefixes = config.toolFlows
      .map((toolFlow) => flowSearchTerms[toolFlow])
      .filter((value): value is string => Boolean(value));

    if (prefixes.length > 0) {
      lines.push(
        `(${prefixes
          .map(
            (prefix) =>
              `textPayload:"${prefix}" OR jsonPayload.message:"${prefix}"`,
          )
          .join(" OR ")})`,
      );
    }
  }

  return lines.join("\n");
}

function toPrintableEntry(entry: any, index: number): unknown {
  const metadata = entry?.metadata ?? {};

  return {
    index,
    metadata: {
      insertId: metadata.insertId,
      logName: metadata.logName,
      timestamp: metadata.timestamp,
      receiveTimestamp: metadata.receiveTimestamp,
      severity: metadata.severity,
      operation: metadata.operation,
      trace: metadata.trace,
      spanId: metadata.spanId,
      labels: metadata.labels,
      resource: metadata.resource,
    },
    data: entry?.data,
  };
}

async function main(): Promise<void> {
  const config: InspectConfig = {
    projectId: requireEnv("INSPECT_PROJECT_ID"),
    serviceName: requireEnv("INSPECT_SERVICE_NAME"),
    location: process.env.INSPECT_LOCATION || undefined,
    from: requireEnv("INSPECT_FROM"),
    to: requireEnv("INSPECT_TO"),
    limit: Number.parseInt(process.env.INSPECT_LIMIT ?? "100", 10),
    includeMessagePrefixes: parseBoolean(
      process.env.INSPECT_INCLUDE_MESSAGE_PREFIXES,
      true,
    ),
    toolFlows: parseToolFlows(process.env.INSPECT_TOOL_FLOWS),
  };

  if (!Number.isFinite(config.limit) || config.limit <= 0) {
    throw new Error("INSPECT_LIMIT must be a positive integer.");
  }

  const logging = new Logging({ projectId: config.projectId });
  const filter = buildFilter(config);

  console.log("INSPECT_FILTER_START");
  console.log(filter);
  console.log("INSPECT_FILTER_END");

  const [entries] = await logging.getEntries({
    filter,
    pageSize: config.limit,
    orderBy: "timestamp asc",
  });

  const operationCount = entries.filter(
    (entry: any) => typeof entry?.metadata?.operation?.id === "string",
  ).length;
  const traceCount = entries.filter(
    (entry: any) => typeof entry?.metadata?.trace === "string" && entry.metadata.trace.length > 0,
  ).length;

  console.log(
    `INSPECT_SUMMARY ${JSON.stringify({
      projectId: config.projectId,
      serviceName: config.serviceName,
      location: config.location ?? null,
      from: config.from,
      to: config.to,
      limit: config.limit,
      includeMessagePrefixes: config.includeMessagePrefixes,
      toolFlows: config.toolFlows,
      entryCount: entries.length,
      entriesWithOperationId: operationCount,
      entriesWithTrace: traceCount,
    })}`,
  );

  entries.forEach((entry: any, index: number) => {
    console.log(`ENTRY_JSON ${JSON.stringify(toPrintableEntry(entry, index))}`);
  });
}

await main();

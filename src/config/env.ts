import type { LogQuery, ToolFlowName } from "../domain/types.js";

function optionalValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseToolFlows(value: string | undefined): ToolFlowName[] {
  if (!value) {
    return [
      "image_asset_generate",
      "image_variation_generate",
      "spritesheet_generate",
      "spritesheet_variation_generate",
    ];
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is ToolFlowName =>
      [
        "image_asset_generate",
        "image_variation_generate",
        "spritesheet_generate",
        "spritesheet_variation_generate",
        "unknown",
      ].includes(part),
    );
}

function defaultWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    return 1000;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

export interface SnapshotConfig {
  query: LogQuery;
  outputDir: string;
}

export function loadSnapshotConfig(
  env: NodeJS.ProcessEnv = process.env,
): SnapshotConfig {
  const window = defaultWindow();
  const snapshotSource = optionalValue(env.SNAPSHOT_SOURCE);
  const snapshotProjectId = optionalValue(env.SNAPSHOT_PROJECT_ID);
  const snapshotServiceName = optionalValue(env.SNAPSHOT_SERVICE_NAME);
  const snapshotLocation = optionalValue(env.SNAPSHOT_LOCATION);
  const snapshotFrom = optionalValue(env.SNAPSHOT_FROM);
  const snapshotTo = optionalValue(env.SNAPSHOT_TO);
  const snapshotLimit = optionalValue(env.SNAPSHOT_LIMIT);
  const snapshotToolFlows = optionalValue(env.SNAPSHOT_TOOL_FLOWS);
  const snapshotOutputDir = optionalValue(env.SNAPSHOT_OUTPUT_DIR);
  const source =
    snapshotSource === "gcp" || snapshotSource === "sample"
      ? snapshotSource
      : snapshotProjectId && snapshotServiceName
        ? "gcp"
        : "sample";

  return {
    query: {
      source,
      projectId:
        snapshotProjectId ?? (source === "sample" ? "sample-project" : undefined),
      serviceName:
        snapshotServiceName ?? (source === "sample" ? "mcp-agent8" : undefined),
      location:
        snapshotLocation ?? (source === "sample" ? "asia-northeast3" : undefined),
      from: snapshotFrom ?? window.from,
      to: snapshotTo ?? window.to,
      limit: parseLimit(snapshotLimit),
      toolFlows: parseToolFlows(snapshotToolFlows),
    },
    outputDir: snapshotOutputDir ?? "site/data",
  };
}

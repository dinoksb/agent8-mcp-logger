import type { LogQuery, ToolFlowName } from "../domain/types.js";

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
  const source =
    env.SNAPSHOT_SOURCE === "gcp" ||
    env.SNAPSHOT_SOURCE === "sample"
      ? env.SNAPSHOT_SOURCE
      : env.SNAPSHOT_PROJECT_ID && env.SNAPSHOT_SERVICE_NAME
        ? "gcp"
        : "sample";

  return {
    query: {
      source,
      projectId:
        env.SNAPSHOT_PROJECT_ID ?? (source === "sample" ? "sample-project" : undefined),
      serviceName:
        env.SNAPSHOT_SERVICE_NAME ?? (source === "sample" ? "mcp-agent8" : undefined),
      location:
        env.SNAPSHOT_LOCATION ??
        (source === "sample" ? "asia-northeast3" : undefined),
      from: env.SNAPSHOT_FROM ?? window.from,
      to: env.SNAPSHOT_TO ?? window.to,
      limit: parseLimit(env.SNAPSHOT_LIMIT),
      toolFlows: parseToolFlows(env.SNAPSHOT_TOOL_FLOWS),
    },
    outputDir: env.SNAPSHOT_OUTPUT_DIR ?? "site/data",
  };
}

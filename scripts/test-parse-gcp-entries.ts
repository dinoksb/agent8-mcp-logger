/**
 * Parses real GCP log entries through the full pipeline.
 *
 * Usage: npx tsx scripts/test-parse-gcp-entries.ts
 */

import { normalizeRawLogEntries } from "../src/parsing/raw-log-normalizer.js";
import {
  parseLogEntries,
  isRelevantAssetGenerationEvent,
} from "../src/parsing/agent8-log-parser.js";
import { correlateEventsWithStats } from "../src/domain/correlation.js";
import { classifyRuns } from "../src/domain/classification.js";
import { buildSummary } from "../src/reporting/report-builder.js";

// Real GCP entries from inspect-cloud-run-logs (2026-03-12T07:40–07:42)
// Converted from the inspect output: metadata → top-level, data → jsonPayload
const gcpEntries = [
  {
    id: "69b26e0a0008c113497a6294",
    insertId: "69b26e0a0008c113497a6294",
    logName: "projects/agent8-455106/logs/run.googleapis.com%2Fstdout",
    timestamp: "2026-03-12T07:40:58.573Z",
    severity: "INFO",
    operation: null,
    trace: "",
    spanId: "",
    labels: {
      "gcb-trigger-id": "510e14e3-eee0-4e18-b4e3-f18992d56ca5",
      "commit-sha": "b2e9a89494ca7f22416d9f37480c1a91f1e2de49",
    },
    resource: {
      type: "cloud_run_revision",
      labels: {
        location: "asia-east1",
        service_name: "agent8-image-mcp-server",
        configuration_name: "agent8-image-mcp-server",
        revision_name: "agent8-image-mcp-server-00083-q5b",
        project_id: "agent8-455106",
      },
    },
    jsonPayload: {
      model: "nano-banana-2",
      provider: "google",
      operationId: "a81604c1-ffa5-4356-a24c-10a644a170b3",
      message:
        "[ImageGeneration] Image generation requested",
      prompt:
        "Dark fantasy dungeon stone floor tile, seamless tileable texture. Ancient cracked stone bricks with moss, dark atmosphere, eerie glow between the cracks. Top-down view for a vertical scrolling dungeon game. Very dark color palette with subtle green and purple accents.",
      style: "pixel art",
      height: 256,
      assetType: "background",
      width: 256,
      hasReferenceImage: false,
      phase: "request",
      timestamp: "2026-03-12T07:40:58.574Z",
    },
  },
  {
    id: "69b26e0a0008cc35c8e67ba8",
    insertId: "69b26e0a0008cc35c8e67ba8",
    logName: "projects/agent8-455106/logs/run.googleapis.com%2Fstdout",
    timestamp: "2026-03-12T07:40:58.576Z",
    severity: "INFO",
    operation: null,
    trace: "",
    spanId: "",
    labels: {},
    resource: {
      type: "cloud_run_revision",
      labels: {
        service_name: "agent8-image-mcp-server",
        configuration_name: "agent8-image-mcp-server",
        location: "asia-east1",
        project_id: "agent8-455106",
        revision_name: "agent8-image-mcp-server-00083-q5b",
      },
    },
    jsonPayload: {
      message: "[ImageGeneration] Provider request started",
      style: "pixel art",
      operation: "image-generation",
      model: "gemini-3.1-flash-image-preview",
      operationId: "a81604c1-ffa5-4356-a24c-10a644a170b3",
      provider: "google",
      timestamp: "2026-03-12T07:40:58.577Z",
      assetType: "background",
      toolName: "image_asset_generate",
    },
  },
  {
    id: "69b26e2f000c6678c9edb205",
    insertId: "69b26e2f000c6678c9edb205",
    logName: "projects/agent8-455106/logs/run.googleapis.com%2Fstdout",
    timestamp: "2026-03-12T07:41:35.812Z",
    severity: "INFO",
    operation: null,
    trace: "",
    spanId: "",
    labels: {},
    resource: {
      type: "cloud_run_revision",
      labels: {
        project_id: "agent8-455106",
        revision_name: "agent8-image-mcp-server-00083-q5b",
        configuration_name: "agent8-image-mcp-server",
        service_name: "agent8-image-mcp-server",
        location: "asia-east1",
      },
    },
    jsonPayload: {
      candidates: 1,
      durationMs: 37236,
      timestamp: "2026-03-12T07:41:35.813Z",
      toolName: "image_asset_generate",
      assetType: "background",
      style: "pixel art",
      operation: "image-generation",
      message: "[ImageGeneration] Provider request completed",
      operationId: "a81604c1-ffa5-4356-a24c-10a644a170b3",
      provider: "google",
      model: "gemini-3.1-flash-image-preview",
    },
  },
  {
    id: "69b26e2f000c79e4c11453cf",
    insertId: "69b26e2f000c79e4c11453cf",
    logName: "projects/agent8-455106/logs/run.googleapis.com%2Fstdout",
    timestamp: "2026-03-12T07:41:35.817Z",
    severity: "INFO",
    operation: null,
    trace: "",
    spanId: "",
    labels: {},
    resource: {
      type: "cloud_run_revision",
      labels: {
        revision_name: "agent8-image-mcp-server-00083-q5b",
        project_id: "agent8-455106",
        location: "asia-east1",
        configuration_name: "agent8-image-mcp-server",
        service_name: "agent8-image-mcp-server",
      },
    },
    jsonPayload: {
      phase: "post_processing",
      timestamp: "2026-03-12T07:41:35.818Z",
      assetType: "background",
      width: 1024,
      totalDurationMs: 37244,
      message:
        "[ImageGeneration] Google image generation completed; starting post-processing",
      height: 1024,
      style: "pixel art",
      model: "nano-banana-2",
      provider: "google",
      operationId: "a81604c1-ffa5-4356-a24c-10a644a170b3",
    },
  },
  {
    id: "69b26e3200020e18d215598a",
    insertId: "69b26e3200020e18d215598a",
    logName: "projects/agent8-455106/logs/run.googleapis.com%2Fstdout",
    timestamp: "2026-03-12T07:41:38.134Z",
    severity: "INFO",
    operation: null,
    trace: "",
    spanId: "",
    labels: {},
    resource: {
      type: "cloud_run_revision",
      labels: {
        configuration_name: "agent8-image-mcp-server",
        service_name: "agent8-image-mcp-server",
        location: "asia-east1",
        project_id: "agent8-455106",
        revision_name: "agent8-image-mcp-server-00083-q5b",
      },
    },
    jsonPayload: {
      provider: "google",
      operationId: "a81604c1-ffa5-4356-a24c-10a644a170b3",
      model: "nano-banana-2",
      height: 1024,
      style: "pixel art",
      message: "[ImageGeneration] Asset post-processing completed",
      assetType: "background",
      width: 1024,
      durationMs: 2315,
      url: "https://agent8-games.verse8.io/mcp-agent8-generated/static-assets/background-1773301295828.png",
      phase: "post_processing",
      timestamp: "2026-03-12T07:41:38.135Z",
    },
  },
];

// ── 1. Normalize ────────────────────────────────────────────────
const normalized = normalizeRawLogEntries(gcpEntries);
console.log(`\n=== 1. NORMALIZE === (${normalized.length} entries)\n`);
for (const entry of normalized) {
  console.log(
    `  [${entry.id.slice(0, 12)}] sev=${entry.severity ?? "?"} | opId=${entry.operationId ?? "-"} | json.message=${(entry.jsonPayload?.message as string)?.slice(0, 60) ?? "-"}`,
  );
}

// ── 2. Parse ────────────────────────────────────────────────────
const events = parseLogEntries(normalized);
const relevant = events.filter(isRelevantAssetGenerationEvent);

console.log(
  `\n=== 2. PARSE === (${events.length} events, ${relevant.length} relevant)\n`,
);
for (const event of events) {
  console.log(`  [${event.rawEntryId.slice(0, 12)}]`);
  console.log(`    stage:       ${event.stage}`);
  console.log(`    toolFlow:    ${event.toolFlow}`);
  console.log(`    operationId: ${event.operationId ?? "-"}`);
  console.log(`    provider:    ${event.provider ?? "-"}`);
  console.log(`    model:       ${event.model ?? "-"}`);
  console.log(`    durationMs:  ${event.durationMs ?? "-"}`);
  console.log(`    prompt:      ${event.prompt?.slice(0, 50) ?? "-"}`);
  console.log(`    url:         ${event.url ?? "-"}`);
  console.log(`    style:       ${event.style ?? "-"}`);
  console.log(`    assetType:   ${event.assetType ?? "-"}`);
  console.log(`    width:       ${event.width ?? "-"}`);
  console.log(`    height:      ${event.height ?? "-"}`);
  console.log(`    message:     ${event.message.slice(0, 60)}`);
  console.log();
}

// ── 3. Correlate ────────────────────────────────────────────────
const { runs, keyStats } = correlateEventsWithStats(relevant);
console.log(`=== 3. CORRELATE === (${runs.length} runs)\n`);
console.log(`  keyStats: operationId=${keyStats.operationId} requestId=${keyStats.requestId} trace=${keyStats.trace} bucket=${keyStats.bucket}\n`);
for (const run of runs) {
  console.log(`  Run: ${run.runId}`);
  console.log(`    toolFlow:   ${run.toolFlow}`);
  console.log(`    status:     ${run.status}`);
  console.log(`    opId:       ${run.operationId ?? "-"}`);
  console.log(`    providers:  ${run.providerChain.join(" → ") || "-"}`);
  console.log(`    duration:   ${run.totalDurationMs != null ? `${run.totalDurationMs}ms` : "-"}`);
  console.log(`    prompt:     ${run.prompt?.slice(0, 60) ?? "-"}`);
  console.log(`    resultUrl:  ${run.resultUrl ?? "-"}`);
  console.log(
    `    stages:     ${run.stages.map((s) => `${s.stage}(${s.durationMs ?? "?"}ms)`).join(" → ")}`,
  );
  console.log(`    events:     ${run.evidenceEventIds.length}`);
  console.log();
}

// ── 4. Classify ─────────────────────────────────────────────────
const { runs: classifiedRuns, incidents } = classifyRuns(runs, relevant);
console.log(`=== 4. CLASSIFY === (${incidents.length} incidents)\n`);
for (const incident of incidents) {
  console.log(`  [${incident.severity}] ${incident.summary}`);
  console.log(`    run: ${incident.runId}`);
  console.log();
}

// ── 5. Summary ──────────────────────────────────────────────────
const summary = buildSummary(classifiedRuns, incidents);
console.log(`=== 5. REPORT SUMMARY ===\n`);
console.log(`  totalRuns:     ${summary.totalRuns}`);
console.log(`  completed:     ${summary.completedRuns}`);
console.log(`  failed:        ${summary.failedRuns}`);
console.log(`  runsByFlow:    ${JSON.stringify(summary.runsByFlow)}`);

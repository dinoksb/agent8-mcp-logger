/**
 * Runs sample entries through the full pipeline and prints results.
 *
 * Usage: npx tsx scripts/test-parse-pipeline.ts
 */

import { sampleEntries } from "../src/testing/sample-entries.js";
import { normalizeRawLogEntries } from "../src/parsing/raw-log-normalizer.js";
import { parseLogEntries, isRelevantAssetGenerationEvent } from "../src/parsing/agent8-log-parser.js";
import { correlateEventsWithStats } from "../src/domain/correlation.js";
import { classifyRuns } from "../src/domain/classification.js";
import { buildReportPayload, buildSummary } from "../src/reporting/report-builder.js";

// ── 1. Normalize ────────────────────────────────────────────────
const normalized = normalizeRawLogEntries(sampleEntries);
console.log(`\n=== 1. NORMALIZE === (${normalized.length} entries)\n`);
for (const entry of normalized) {
  console.log(
    `  [${entry.id}] ${entry.severity ?? "?"} | opId=${entry.operationId ?? "-"} | text=${entry.textPayload?.slice(0, 60) ?? "-"} | json.message=${(entry.jsonPayload?.message as string)?.slice(0, 60) ?? "-"}`,
  );
}

// ── 2. Parse ────────────────────────────────────────────────────
const events = parseLogEntries(normalized);
const relevant = events.filter(isRelevantAssetGenerationEvent);

console.log(`\n=== 2. PARSE === (${events.length} events, ${relevant.length} relevant)\n`);
console.log("  %-12s %-30s %-20s %-16s %-20s %-15s %s");
for (const event of events) {
  console.log(
    `  %-12s %-30s %-20s %-16s %-20s %-15s %s`,
    event.stage,
    event.toolFlow,
    event.operationId ?? "-",
    event.requestId ?? "-",
    event.provider ?? "-",
    event.durationMs != null ? `${event.durationMs}ms` : "-",
    event.message.slice(0, 50),
  );
}

// ── 3. Prompt / URL extraction ──────────────────────────────────
console.log(`\n=== 3. PROMPT & URL per event ===\n`);
for (const event of events) {
  if (event.prompt || event.url) {
    console.log(
      `  [${event.rawEntryId}] stage=${event.stage} | prompt=${event.prompt?.slice(0, 40) ?? "-"} | url=${event.url ?? "-"}`,
    );
  }
}

// ── 4. Correlate ────────────────────────────────────────────────
const { runs, keyStats } = correlateEventsWithStats(relevant);
console.log(`\n=== 4. CORRELATE === (${runs.length} runs)\n`);
console.log(`  keyStats: operationId=${keyStats.operationId} requestId=${keyStats.requestId} trace=${keyStats.trace} bucket=${keyStats.bucket}\n`);
for (const run of runs) {
  console.log(`  Run: ${run.runId}`);
  console.log(`    toolFlow:   ${run.toolFlow}`);
  console.log(`    status:     ${run.status}`);
  console.log(`    opId:       ${run.operationId ?? "-"}`);
  console.log(`    reqId:      ${run.requestId ?? "-"}`);
  console.log(`    trace:      ${run.trace ?? "-"}`);
  console.log(`    providers:  ${run.providerChain.join(" → ") || "-"}`);
  console.log(`    fallback:   ${run.fallbackUsed}`);
  console.log(`    duration:   ${run.totalDurationMs != null ? `${run.totalDurationMs}ms` : "-"}`);
  console.log(`    prompt:     ${run.prompt?.slice(0, 60) ?? "-"}`);
  console.log(`    resultUrl:  ${run.resultUrl ?? "-"}`);
  console.log(`    stages:     ${run.stages.map((s) => `${s.stage}(${s.durationMs ?? "?"}ms)`).join(" → ")}`);
  console.log(`    events:     ${run.evidenceEventIds.length}`);
  console.log();
}

// ── 5. Classify ─────────────────────────────────────────────────
const { runs: classifiedRuns, incidents } = classifyRuns(runs, relevant);
console.log(`=== 5. CLASSIFY === (${incidents.length} incidents)\n`);
for (const incident of incidents) {
  console.log(`  [${incident.severity}] ${incident.summary}`);
  console.log(`    run:    ${incident.runId}`);
  console.log(`    explain: ${incident.explanation.slice(0, 80)}`);
  console.log();
}

// ── 6. Report summary ───────────────────────────────────────────
const summary = buildSummary(classifiedRuns, incidents);
console.log(`=== 6. REPORT SUMMARY ===\n`);
console.log(`  totalRuns:     ${summary.totalRuns}`);
console.log(`  completed:     ${summary.completedRuns}`);
console.log(`  failed:        ${summary.failedRuns}`);
console.log(`  handedOff:     ${summary.handedOffRuns}`);
console.log(`  queueTimeouts: ${summary.queueTimeouts}`);
console.log(`  incidents:     info=${summary.incidentsBySeverity.info} warn=${summary.incidentsBySeverity.warning} crit=${summary.incidentsBySeverity.critical}`);
console.log(`  runsByFlow:    ${JSON.stringify(summary.runsByFlow)}`);

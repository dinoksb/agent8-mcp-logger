import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchCloudLoggingEntries } from "../src/adapters/gcp-logging.js";
import { loadSnapshotConfig } from "../src/config/env.js";
import { classifyRuns } from "../src/domain/classification.js";
import { correlateEvents } from "../src/domain/correlation.js";
import { parseLogEntries } from "../src/parsing/agent8-log-parser.js";
import {
  buildReportPayload,
  buildRunsPayload,
} from "../src/reporting/report-builder.js";
import { sampleEntries } from "../src/testing/sample-entries.js";

async function main(): Promise<void> {
  const config = loadSnapshotConfig();
  const outputDir = resolve(process.cwd(), config.outputDir);
  const rawEntries =
    config.query.source === "gcp"
      ? await fetchCloudLoggingEntries(config.query)
      : sampleEntries;
  const events = parseLogEntries(rawEntries);
  const correlatedRuns = correlateEvents(events);
  const classified = classifyRuns(correlatedRuns, events);
  const generatedAt = new Date().toISOString();
  const report = buildReportPayload({
    generatedAt,
    coveredFrom: config.query.from,
    coveredTo: config.query.to,
    query: config.query,
    runs: classified.runs,
    incidents: classified.incidents,
  });
  const runsPayload = buildRunsPayload(report);

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    resolve(outputDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outputDir, "runs.json"),
    `${JSON.stringify(runsPayload, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Snapshot written to ${outputDir} with ${report.summary.totalRuns} runs and ${report.incidents.length} incidents.`,
  );
}

main().catch((error) => {
  console.error("Snapshot build failed.");
  console.error(error);
  process.exitCode = 1;
});


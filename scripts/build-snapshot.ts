import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchCloudLoggingEntries } from "../src/adapters/gcp-logging.js";
import { loadSnapshotConfig } from "../src/config/env.js";
import type { ParsedLogEvent } from "../src/domain/types.js";
import { classifyRuns } from "../src/domain/classification.js";
import { correlateEvents } from "../src/domain/correlation.js";
import { parseLogEntries } from "../src/parsing/agent8-log-parser.js";
import {
  buildReportPayload,
  buildRunsPayload,
} from "../src/reporting/report-builder.js";
import { sampleEntries } from "../src/testing/sample-entries.js";

function countRecognizedEvents(events: ParsedLogEvent[]): number {
  return events.filter(
    (event) => event.toolFlow !== "unknown" || event.stage !== "unknown",
  ).length;
}

async function main(): Promise<void> {
  const config = loadSnapshotConfig();
  const outputDir = resolve(process.cwd(), config.outputDir);
  const fetchResult =
    config.query.source === "gcp"
      ? await fetchCloudLoggingEntries(config.query)
      : {
          entries: sampleEntries,
          strategy: "sample_data",
          notes: ["Using bundled sample entries instead of Cloud Logging."],
        };
  const rawEntries = fetchResult.entries;
  const events = parseLogEntries(rawEntries);
  const recognizedEventCount = countRecognizedEvents(events);
  const correlatedRuns = correlateEvents(events);
  const classified = classifyRuns(correlatedRuns, events);
  const generatedAt = new Date().toISOString();
  const diagnosticsNotes = [...fetchResult.notes];

  if (rawEntries.length === 0) {
    diagnosticsNotes.push(
      "Check SNAPSHOT_SERVICE_NAME, SNAPSHOT_LOCATION, SNAPSHOT_FROM/SNAPSHOT_TO, or GCP auth if this window should contain traffic.",
    );
  } else if (recognizedEventCount === 0) {
    diagnosticsNotes.push(
      "Logs were fetched, but the parser recognized zero Agent8 events. The live log format or search filter likely needs adjustment.",
    );
  } else if (classified.runs.length === 0) {
    diagnosticsNotes.push(
      "Agent8-like events were found, but no correlated runs were produced. Operation ID or request ID linkage may be missing in the live logs.",
    );
  }

  const report = buildReportPayload({
    generatedAt,
    coveredFrom: config.query.from,
    coveredTo: config.query.to,
    query: config.query,
    diagnostics: {
      fetchedEntryCount: rawEntries.length,
      parsedEventCount: events.length,
      recognizedEventCount,
      runCount: classified.runs.length,
      fetchStrategy: fetchResult.strategy,
      notes: diagnosticsNotes,
    },
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
    `Snapshot written to ${outputDir} with ${report.summary.totalRuns} runs, ${report.incidents.length} incidents, ${rawEntries.length} fetched entries, and strategy ${fetchResult.strategy}.`,
  );
}

main().catch((error) => {
  console.error("Snapshot build failed.");
  console.error(error);
  process.exitCode = 1;
});

# Cloud Run Log Inspector POC Foundation

## Purpose

This document captures the baseline knowledge needed to build a separate proof-of-concept project that:

- reads Cloud Run logs from Google Cloud Logging
- parses image and spritesheet generation logs emitted by the Agent8 MCP Server
- identifies bottlenecks by stage
- identifies likely timeout causes
- produces a lightweight operational report or dashboard

The goal is to make it possible to start the external project immediately without needing to rediscover the current Agent8 logging behavior.

## Local Source Repository Path

If the external POC project needs deeper implementation details about the source system, use this local repository path as the primary code reference:

- `d:\work\planetarium\2025\mcp-agent8`

The external project should treat that path as the local source-of-truth reference for:

- current log message shapes
- provider and fallback behavior
- queue timeout behavior
- spritesheet analysis and upload stages
- any future parser updates needed when log wording or metadata fields change

If the external project needs more detail than this document provides, it should inspect code directly from that path before introducing new parsing or classification rules.

## Important Context About `PROJECT.md`

As of `2026-03-11`, the local `main` branch and `origin/main` in this repository do not contain a tracked `PROJECT.md` file.

Because of that, this document uses:

- the current working-tree `PROJECT.md` in this branch as the available project-summary source
- the current source files in this repository as the source of truth for actual logging behavior

If a future `main` branch adds a tracked `PROJECT.md`, this document should be reconciled against that version.

## Source Project Summary

### Snapshot From Current `PROJECT.md`

The current branch-level `PROJECT.md` describes this repository as:

- a TypeScript MCP server
- focused on prompt templates, search tools, theme tools, and asset generation tools
- especially relevant to image generation and spritesheet generation workflows for game development

The current `PROJECT.md` also highlights these areas as especially relevant:

- `src/tools/asset-generate/spritesheet/spritesheet-generator.ts`
- `src/tools/asset-generate/common/constants.ts`

### Relevant Operational Behavior From Current Code

The codebase currently contains four flows that matter for the proposed POC:

1. `image_asset_generate`
2. `image_variation_generate`
3. `spritesheet_generate`
4. `spritesheet_variation_generate`

Those flows do not all behave the same way:

- `image_*` flows use a Google primary path and a fal queue-based fallback path
- `spritesheet_*` flows use a Google primary path and a fal direct fallback path
- `image_*` timeouts are strongly tied to fal queue behavior
- `spritesheet_*` bottlenecks are strongly tied to provider generation time and, for new spritesheets, grid analysis time

### Current Project Changes That Matter To The POC

From the current `PROJECT.md` and current code, the external POC should assume the following:

- image generation now has explicit fal queue concepts such as queue submission, inline wait, handoff to status polling, queue timeout, and fallback retry
- spritesheet generation has stage-oriented logging around provider request, analysis, background removal, upload, and completion
- spritesheet variation has reference-image handling before generation
- spritesheet background removal is local and generally not the dominant bottleneck
- spritesheet timing benchmarks already exist in this repository and can be used as an initial baseline

## What The External POC Should Do

The external project should answer questions like:

- which stage is slowest for a given run?
- is the slowdown in model generation, queue waiting, reference fetch, analysis, background removal, or upload?
- did the request fail because the primary model failed?
- did the request fail because fal remained in `IN_QUEUE` too long?
- did the request exceed the inline wait window and get handed off instead of actually failing?
- which revision or deployment introduced the regression?

## Recommended POC Scope

### In Scope

- Cloud Logging API ingestion
- Cloud Run service log filtering
- parsing structured and semi-structured logs
- grouping multiple log entries into a single logical run
- stage timeline generation
- bottleneck classification
- timeout classification
- simple JSON API
- simple HTML dashboard or static report

### Out Of Scope For First POC

- full multi-tenant auth
- long-term warehouse-grade analytics
- real-time alerting
- cross-project fleet management
- automatic remediation

## Deployment Recommendation

Do not plan around `git.io`.

- GitHub no longer accepts new `git.io` URLs.
- `git.io` is not a hosting platform.
- if you want static hosting from GitHub, use GitHub Pages
- if you want secure server-side access to Cloud Logging, use Cloud Run for the backend

For the first externally shared POC, the simplest delivery is:

- source code in a GitHub repository
- a local script or CI job that queries Cloud Logging and generates a fixed-time snapshot report
- static HTML and JSON artifacts published on GitHub Pages

This is recommended for phase 1 because:

- external sharing is required immediately
- the report does not need to be real-time yet
- no public runtime access to Cloud Logging is required
- browser-side credential handling is avoided
- the parsing and classification logic can later be reused in a real-time backend

### Recommended Option A: GitHub Pages Static Snapshot

Best for phase 1.

- generate a fixed-time report for a chosen window such as `last 24 hours`
- publish `index.html` plus JSON artifacts such as `report.json` and `runs.json`
- clearly show `generatedAt`, `coveredFrom`, and `coveredTo`
- support either manual refreshes or scheduled refreshes

### Recommended Option B: Real-Time Backend Later

Best for phase 2 after the POC proves useful.

- keep the same parser, correlator, classifier, and report builder
- replace the snapshot job with an HTTP backend that queries Cloud Logging on demand
- Cloud Run is preferred for GCP-native auth
- Vercel or another hosted Node runtime can also work if credential handling is explicitly managed

Do not call Cloud Logging directly from a public browser-only app unless you are intentionally building an OAuth-based internal tool.

## External Project Stack Recommendation

Keep the first version simple.

### Backend

- Node.js 20+
- TypeScript
- `@google-cloud/logging` or direct REST calls to Cloud Logging
- `zod` for schema validation
- a phase-1 snapshot build script
- `hono` or `express` for the later real-time HTTP API

### Frontend

Either:

- a plain static HTML page on GitHub Pages backed by generated JSON artifacts

or:

- Vite + React
- simple table and timeline views
- later switch the data source from local JSON files to API responses without rewriting the UI

### Storage

For the first POC, storage can be optional.

Start with in-memory processing for ad hoc queries.

If persistence is needed, add one of:

- SQLite for local/offline testing
- Postgres for Cloud Run-hosted persistence
- BigQuery only if you intentionally expand beyond POC scale

## Recommended Delivery Phases

### Phase 1: Static Snapshot Delivery

Use a fixed-time snapshot for the first externally shared version.

- run a local script or CI job
- query Cloud Logging for a chosen time window
- produce `report.json`, `runs.json`, and a static `index.html`
- deploy those artifacts to GitHub Pages
- include `generatedAt`, `coveredFrom`, and `coveredTo` in the report payload

### Phase 2: Real-Time Delivery

After the POC proves useful, add a backend.

- expose an API such as `POST /api/logs/query` and `GET /api/report`
- move Cloud Logging access behind the backend
- keep the frontend report format stable so the UI can switch from local JSON to API responses with minimal changes

### Architecture Rules To Preserve Easy Migration

- keep Cloud Logging access in an adapter layer
- keep parsing, correlation, and classification as pure domain modules
- keep the report builder independent of whether data came from a static file or live API
- define one stable report payload shape that can be written to disk or returned over HTTP
- avoid coupling UI components to a specific deployment mode

## Current Implementation Validation Notes

As of `2026-03-12`, the initial POC implementation in this repository has already validated several details directly against `d:\work\planetarium\2025\mcp-agent8`.

These points should be treated as the current parser contract until the source repo changes again.

- do parser and correlation validation before wiring GitHub Pages or GitHub Actions deployment
- normalize `fal queue accepted` to `queue_submit` even when raw `phase` is `provider_request`
- normalize `fal queue timed out in IN_QUEUE` as a `queue_wait` bottleneck with failed run status
- preserve `Background removal completed` as its own canonical stage instead of collapsing it into generic post-processing
- preserve `Status tool called/completed` as `status_poll`
- preserve `Result tool called` as `result_fetch`
- treat `Result tool completed` as terminal completion evidence
- parse `modelPath` as a valid model identifier fallback when `model` is absent
- support `requestId`-only follow-up logs by aliasing them back to the owning `operationId` when earlier events contain both identifiers
- keep fallback chains in one run even when later status or result events arrive after `handing off to status polling`

## GitHub Automation Strategy

Use GitHub for two different automation responsibilities.

### 1. GitHub Actions For Operational Automation

GitHub Actions should own the phase-1 delivery loop.

- support `workflow_dispatch` for manual refreshes
- support `schedule` for periodic snapshot refreshes
- authenticate to Google Cloud from GitHub Actions
- run the snapshot build script
- publish the generated `site/` artifacts to GitHub Pages

Recommended authentication order:

1. Workload Identity Federation
2. read-only service account key only if federation is not available yet

The workflow should treat snapshot generation and static deployment as one pipeline.

### 2. Codex Or Other GitHub Coding Agents For Code Automation

Coding agents should help with repository maintenance, not with runtime log access.

- create or update implementation PRs
- review parser and classifier changes
- propose documentation updates
- help keep workflows and report UI in sync with evolving requirements

Do not make a coding agent responsible for production-time Cloud Logging access.

### Recommended Separation Of Responsibilities

- GitHub Actions: scheduled snapshot generation and GitHub Pages deployment
- this repository code: parsing, correlation, classification, and report generation
- coding agent: PR creation, reviews, refactors, and documentation support

This separation keeps the runtime path simple and avoids mixing repository automation with operational data access.

## Current Log Sources In This Repository

### Image Asset Generation

Primary file:

- `src/tools/asset-generate/image/image-generation.ts`

Important behavior:

- Google primary path
- fal queue fallback path
- queue timeout and inline handoff logic
- post-processing after final image retrieval

### Image Variation

Primary file:

- `src/tools/asset-generate/image/image-variation.ts`

Important behavior:

- same queue-oriented fal fallback pattern as image asset generation
- reference-image based workflow

### Spritesheet Generation

Primary file:

- `src/tools/asset-generate/spritesheet/spritesheet-generator.ts`

Important behavior:

- provider request
- grid analysis
- local background removal
- upload

### Spritesheet Variation

Primary file:

- `src/tools/asset-generate/spritesheet/spritesheet-variation.ts`

Important behavior:

- reference image fetch
- reference-type detection
- provider request
- local background removal
- upload

### Recommended Source Files To Inspect From The Local Path

When the external POC needs exact implementation details, inspect these files under:

- `d:\work\planetarium\2025\mcp-agent8`

Recommended starting points:

- `src/tools/asset-generate/image/image-generation.ts`
- `src/tools/asset-generate/image/image-variation.ts`
- `src/tools/asset-generate/image/image-status.ts`
- `src/tools/asset-generate/spritesheet/spritesheet-generator.ts`
- `src/tools/asset-generate/spritesheet/spritesheet-variation.ts`
- `src/tools/asset-generate/spritesheet/background-removal.ts`
- `src/tools/asset-generate/common/constants.ts`
- `src/tools/asset-generate/common/utils.ts`
- `src/tools/asset-generate/common/queue-utils.ts`
- `src/tools/asset-generate/common/queue-errors.ts`
- `src/clients/google/google-client.ts`
- `PROJECT.md`
- `docs/spritesheet-timing-benchmark-notes.md`
- `docs/image-fal-queue-summary.md`

The external project should prefer reading those files directly instead of relying on stale copied notes if:

- a parser rule stops matching
- a timeout threshold appears to have changed
- provider/fallback sequencing is different from this document
- a new tool flow is added
- the final diagnosis output needs stronger evidence

## Known Timing Baselines From This Repository

Reference document:

- `docs/spritesheet-timing-benchmark-notes.md`

Measured averages recorded there:

### `spritesheet_generate`

`4x4`

- generation: about `19.8s`
- analysis: about `6.9s`
- background removal: about `0.1s`
- upload: about `2.0s`
- total: about `28.9s`

`8x8`

- generation: about `21.2s`
- analysis: about `9.7s`
- background removal: about `0.1s`
- upload: about `2.0s`
- total: about `33.1s`

### `spritesheet_variation_generate`

`4x4`

- reference fetch: about `1.0s`
- reference analysis: about `0s`
- generation: about `19.7s`
- background removal: about `0.1s`
- upload: about `2.0s`
- total: about `22.9s`

`8x8`

- reference fetch: about `1.1s`
- reference analysis: about `0s`
- generation: about `19.8s`
- background removal: about `0.1s`
- upload: about `2.0s`
- total: about `23.0s`

### Why These Baselines Matter

The first version of the classifier can use these numbers to decide whether a run is:

- normal
- slow
- severely regressed

Example initial thresholds:

- generation slow: `> 30s`
- spritesheet analysis slow: `> 12s`
- upload slow: `> 5s`
- reference fetch slow: `> 3s`

These thresholds should be configurable.

## Timeouts And Queue Behavior That The POC Must Understand

Relevant constants:

- `AUTHENTICATED_TIMEOUT = 600000` ms
- `DEFAULT_QUEUE_REQUEST_TIMEOUT_MS = 120000` ms
- `IMAGE_QUEUE_INLINE_WAIT_MS = 60000` ms
- `IMAGE_QUEUE_IN_QUEUE_TIMEOUT_MS = 15000` ms

Implications:

- if fal remains in `IN_QUEUE` for more than `15s`, the current image flow treats it as stalled
- if the queue work does not finish within `60s`, the code hands the work off to explicit status polling instead of waiting inline forever
- direct authenticated provider and upload requests can wait up to `10 minutes`

This distinction matters:

- `queue timed out in IN_QUEUE` means queue backlog or queue start failure
- `handing off to status polling` means not an immediate failure
- provider request started but never completed may indicate provider timeout, network issue, crash, or log loss

## Proposed Data Model

The external project should keep a strict separation between:

- raw log entries
- normalized events
- correlated runs
- derived incidents

### 1. Raw Log Entry

```ts
export interface RawLogEntryRecord {
  id: string;
  insertId?: string;
  logName: string;
  timestamp: string;
  receiveTimestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  labels?: Record<string, string>;
  resource: {
    type: string;
    labels: {
      project_id?: string;
      service_name?: string;
      revision_name?: string;
      configuration_name?: string;
      location?: string;
      [key: string]: string | undefined;
    };
  };
  trace?: string;
  spanId?: string;
  source: 'cloud_logging_api';
}
```

### 2. Parsed Event

```ts
export type ToolFlowName =
  | 'image_asset_generate'
  | 'image_variation_generate'
  | 'spritesheet_generate'
  | 'spritesheet_variation_generate'
  | 'unknown';

export type EventStage =
  | 'request'
  | 'reference_fetch'
  | 'reference_analysis'
  | 'provider_request'
  | 'queue_submit'
  | 'queue_wait'
  | 'analysis'
  | 'background_removal'
  | 'post_processing'
  | 'status_poll'
  | 'result_fetch'
  | 'upload'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface ParsedLogEvent {
  eventId: string;
  rawEntryId: string;
  timestamp: string;
  severity: string;
  projectId?: string;
  location?: string;
  serviceName?: string;
  revisionName?: string;
  toolFlow: ToolFlowName;
  message: string;
  stage: EventStage;
  operationId?: string;
  requestId?: string;
  trace?: string;
  spanId?: string;
  provider?: 'google' | 'fal' | 'google-vertex-ai' | 'google-api-key' | 'unknown';
  model?: string;
  phase?: string;
  durationMs?: number;
  totalDurationMs?: number;
  assetType?: string;
  style?: string;
  width?: number;
  height?: number;
  rows?: number;
  cols?: number;
  numImages?: number;
  queuePosition?: number;
  queued?: boolean;
  referenceType?: 'spritesheet' | 'static';
  fallbackFromModel?: string;
  status?: string;
  url?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}
```

### 3. Correlated Run

```ts
export type RunStatus =
  | 'completed'
  | 'failed'
  | 'in_progress'
  | 'handed_off'
  | 'unknown';

export interface StageTiming {
  stage: EventStage;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  sourceEventIds: string[];
}

export interface CorrelatedRun {
  runId: string;
  projectId?: string;
  location?: string;
  serviceName?: string;
  revisionName?: string;
  toolFlow: ToolFlowName;
  operationId?: string;
  requestId?: string;
  startedAt: string;
  endedAt?: string;
  status: RunStatus;
  providerChain: string[];
  primaryProvider?: string;
  fallbackUsed: boolean;
  stages: StageTiming[];
  totalDurationMs?: number;
  bottleneckStage?: EventStage;
  bottleneckDurationMs?: number;
  timeoutKind?: TimeoutKind;
  failureKind?: FailureKind;
  evidenceEventIds: string[];
}
```

### 4. Incident / Diagnosis

```ts
export type TimeoutKind =
  | 'fal_in_queue_timeout'
  | 'fal_request_timeout'
  | 'provider_timeout'
  | 'upload_timeout'
  | 'unknown_timeout';

export type FailureKind =
  | 'queue_backlog'
  | 'primary_provider_failure'
  | 'fallback_provider_failure'
  | 'analysis_slow'
  | 'upload_slow'
  | 'reference_fetch_slow'
  | 'missing_completion'
  | 'unknown_failure';

export interface IncidentReport {
  incidentId: string;
  runId: string;
  detectedAt: string;
  severity: 'info' | 'warning' | 'critical';
  timeoutKind?: TimeoutKind;
  failureKind?: FailureKind;
  summary: string;
  explanation: string;
  recommendedAction?: string;
  evidenceEventIds: string[];
}
```

### 5. Sync Checkpoint

```ts
export interface SyncCheckpoint {
  checkpointId: string;
  projectId: string;
  serviceName?: string;
  lastTimestamp: string;
  lastInsertId?: string;
  pageToken?: string;
  updatedAt: string;
}
```

## Optional Relational Tables

If you persist data, a minimal SQL model can be:

- `raw_log_entries`
- `parsed_log_events`
- `correlated_runs`
- `incident_reports`
- `sync_checkpoints`

Suggested key fields:

### `raw_log_entries`

- `id`
- `timestamp`
- `project_id`
- `service_name`
- `revision_name`
- `severity`
- `payload_json`

### `parsed_log_events`

- `id`
- `raw_entry_id`
- `tool_flow`
- `stage`
- `operation_id`
- `request_id`
- `provider`
- `model`
- `duration_ms`
- `total_duration_ms`
- `metadata_json`

### `correlated_runs`

- `id`
- `tool_flow`
- `operation_id`
- `request_id`
- `service_name`
- `revision_name`
- `started_at`
- `ended_at`
- `status`
- `fallback_used`
- `total_duration_ms`
- `bottleneck_stage`
- `timeout_kind`
- `failure_kind`

## Parsing Rules

The parser should be tolerant.

The project currently logs a mix of:

- structured metadata objects
- message strings
- provider-specific fields

### Preferred Parsing Order

1. parse `jsonPayload` if present
2. if `jsonPayload.message` exists, use it
3. if only `textPayload` exists, parse it with regex and known prefixes
4. preserve the original payload even when parsing fails

### Canonical Correlation Keys

Use this order:

1. `operationId`
2. `requestId`
3. `trace`
4. fallback window: `serviceName + toolFlow + revisionName + timestamp bucket`

### Standardized Message Mapping

The classifier should map current known log messages to canonical stages.

#### Image Asset

Examples to recognize:

- `Image generation requested`
- `Primary model failed; starting fallback`
- `fal generation started`
- `fal queue accepted`
- `fal queue completed`
- `fal queue timed out in IN_QUEUE`
- `fal queue still running; handing off to status polling`
- `Status tool called`
- `Status tool completed`
- `Result tool called`
- `Result tool completed`
- `Google image generation completed; starting post-processing`
- `Background removal completed`
- `Asset post-processing completed`

#### Image Variation

Examples to recognize:

- `Variation requested`
- `Variation generation started`
- `Primary model failed; starting fallback`
- `fal queue accepted`
- `fal queue completed`
- `fal queue timed out in IN_QUEUE`
- `fal queue still running; handing off to status polling`
- `Status tool called`
- `Status tool completed`
- `Result tool called`
- `Result tool completed`
- `Google variation completed; starting post-processing`
- `Background removal completed`
- `Variation post-processing completed`

#### Spritesheet Generation

Examples to recognize:

- `Provider request started`
- `Provider request completed`
- `Primary model failed; starting fallback`
- `Spritesheet analysis completed`
- `Background removal completed`
- `Spritesheet upload completed`
- `Spritesheet generation completed`

#### Spritesheet Variation

Examples to recognize:

- `Spritesheet variation requested`
- `Provider request started`
- `Provider request completed`
- `Primary model failed; starting fallback`
- `Background removal completed`
- `Spritesheet upload completed`
- `Spritesheet variation completed`

### Important Parser Rule

Do not rely only on exact English strings.

Also parse:

- `phase`
- `provider`
- `model`
- `durationMs`
- `totalDurationMs`
- `requestId`
- `operationId`

This makes the parser more stable if message wording changes slightly.

## Correlation Rules

### Rule 1: `operationId` Wins

If several events share the same `operationId`, treat them as one run unless there is clear evidence of overlap from separate requests.

### Rule 2: `requestId` Is Secondary

For fal queue events, `requestId` is often the most stable provider-level identifier.

Use it to join:

- queue submit
- queue wait
- queue timeout
- queue completion

If later status or result logs only carry `requestId`, alias them back into the existing `operationId` run when an earlier event already established the `operationId <-> requestId` link.

If both `requestId` and `trace` exist but `operationId` is missing on the later event, prefer the previously learned `operationId` mapping over creating a new trace-only run.

### Rule 3: Fallback Chains Stay In One Run

If a run shows:

- primary request start
- primary failure
- fallback start
- fallback queue accepted or fallback provider completed

then keep all of that under one correlated run, not two.

### Rule 4: Handoff Is Not Failure

If a run ends with:

- `fal queue still running; handing off to status polling`

then the run status should be `handed_off`, not `failed`.

## Diagnosis Rules

### Queue Backlog

Conditions:

- message indicates `fal queue timed out in IN_QUEUE`
- or `FalQueueTimeoutError`

Classification:

- `timeoutKind = fal_in_queue_timeout`
- `failureKind = queue_backlog`

### Inline Wait Exceeded

Conditions:

- message indicates `handing off to status polling`
- no failure event follows immediately

Classification:

- `status = handed_off`
- not an outage by itself

### Primary Provider Failure

Conditions:

- `Primary model failed`
- then fallback starts

Classification:

- `failureKind = primary_provider_failure`
- severity depends on whether fallback succeeded

### Provider Slow

Conditions:

- provider request duration much larger than known baseline
- especially on spritesheet generation

Classification:

- if generation dominates total time, bottleneck is `provider_request`

### Analysis Slow

Conditions:

- spritesheet analysis stage exceeds expected bounds

Classification:

- `failureKind = analysis_slow`
- bottleneck stage `analysis`

### Upload Slow

Conditions:

- upload stage exceeds expected bounds

Classification:

- `failureKind = upload_slow`
- bottleneck stage `upload`

### Missing Completion

Conditions:

- request started
- no completion
- no explicit failure
- large time gap exceeds configurable threshold

Classification:

- `failureKind = missing_completion`

## Recommended API Surface For The External POC

The current delivery plan is phase 1 static snapshot publishing, but the JSON shapes below should be treated as stable contracts now so the later move to a real-time backend does not require a frontend rewrite.

### Static Artifact Equivalents

- `report.json` should match the `GET /api/report` response shape
- `runs.json` can match the `POST /api/runs/analyze` response shape
- any summary metadata should include `generatedAt`, `coveredFrom`, and `coveredTo`

### `POST /api/logs/query`

Request:

```json
{
  "projectId": "my-gcp-project",
  "serviceName": "mcp-agent8",
  "location": "asia-northeast3",
  "from": "2026-03-11T00:00:00Z",
  "to": "2026-03-11T23:59:59Z",
  "toolFlows": [
    "image_asset_generate",
    "image_variation_generate",
    "spritesheet_generate",
    "spritesheet_variation_generate"
  ],
  "limit": 1000
}
```

Response:

```json
{
  "entries": [],
  "nextPageToken": null
}
```

### `POST /api/runs/analyze`

Request:

```json
{
  "entries": []
}
```

Response:

```json
{
  "runs": [],
  "incidents": [],
  "summary": {
    "totalRuns": 0,
    "failedRuns": 0,
    "handedOffRuns": 0,
    "queueTimeouts": 0
  }
}
```

### `GET /api/report`

Use this to return a synthesized report over a time range.

## Recommended Cloud Logging Filter Template

Start with:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="YOUR_SERVICE_NAME"
timestamp >= "2026-03-11T00:00:00Z"
timestamp <= "2026-03-11T23:59:59Z"
```

Then optionally narrow by message:

```text
(
  SEARCH("ImageGeneration") OR
  SEARCH("ImageVariation") OR
  SEARCH("SpritesheetGeneration") OR
  SEARCH("SpritesheetVariation")
)
```

## Suggested Ingestion Flow

### Phase 1 Snapshot Build Flow

1. Receive a manual trigger or scheduled job
2. Build Cloud Logging filter
3. Call `entries.list`
4. Normalize raw entries
5. Parse entries to canonical events
6. Correlate events into runs
7. Build stage durations
8. Classify bottlenecks and timeout causes
9. Write `report.json`, `runs.json`, and any other snapshot artifacts
10. Publish the static report

### Phase 2 Real-Time Request Flow

1. Receive query from UI or CLI
2. Build Cloud Logging filter
3. Call `entries.list`
4. Normalize raw entries
5. Parse entries to canonical events
6. Correlate events into runs
7. Build stage durations
8. Classify bottlenecks and timeout causes
9. Return report

## Suggested Repository Layout

For a POC, prefer a single repository with shared core modules.

```text
cloud-run-log-inspector-poc/
  README.md
  PROJECT.md
  package.json
  tsconfig.json
  src/
    config/
      env.ts
    adapters/
      gcp-logging.ts
    domain/
      types.ts
      correlation.ts
      classification.ts
    parsing/
      raw-log-normalizer.ts
      agent8-log-parser.ts
      message-map.ts
    reporting/
      report-builder.ts
    contracts/
      report-payload.ts
  scripts/
    build-snapshot.ts
  site/
    index.html
    data/
      report.json
      runs.json
```

When phase 2 real-time delivery is added, extend the same repository with:

```text
cloud-run-log-inspector-poc/
  src/
    app.ts
    routes/
      logs.ts
      runs.ts
      report.ts
  web/
    src/
      main.tsx
      App.tsx
      components/
        RunTable.tsx
        IncidentList.tsx
        TimelineView.tsx
```

If you want the smallest possible phase-1 build:

```text
cloud-run-log-inspector-poc/
  src/
    index.ts
    logging-client.ts
    parser.ts
    correlator.ts
    classifier.ts
    report.ts
  scripts/
    build-snapshot.ts
  site/
    index.html
    data/
      report.json
```

## Suggested `PROJECT.md` For The External Repo

The external repo should include its own `PROJECT.md` from day one.

Suggested minimum sections:

- overview
- goal
- source system
- data model
- parser rules
- correlation rules
- classification rules
- deployment model
- known limitations

## Known Risks

### 1. `PROJECT.md` Drift

This repository's current `PROJECT.md` is not tracked in local `main`.

That means future source-of-truth drift is possible.

### 2. Message Drift

The current parser proposal assumes present log messages remain mostly stable.

To reduce brittleness, parse structured metadata first.

### 3. Queue And Direct Paths Are Different

Do not use one diagnosis rule for all asset-generation flows.

- `image_*` uses queue logic
- `spritesheet_*` does not

### 4. Current Response Payloads Are Not Enough

The old benchmark notes mention `timings` objects, but the current return paths do not appear to expose those timings directly in the final response payloads.

For diagnosis, Cloud Run logs should be treated as the primary evidence source.

### 5. Google Client Timeout Paths Differ

The Google Vertex AI client path explicitly sets a timeout, but the API key client path does not appear to set the same HTTP timeout option in the current wrapper.

The POC should not assume all Google requests time out identically.

### 6. Static Snapshot Staleness

In phase 1, the externally shared report is intentionally not real-time.

- every report must clearly display `generatedAt`, `coveredFrom`, and `coveredTo`
- stale data should not be presented as live operational status
- if staleness becomes operationally misleading, move to phase 2 real-time delivery

### 7. GitHub Automation Credential Drift

If GitHub Actions is used to build snapshots, the authentication path can drift over time.

- Workload Identity Federation bindings may change
- service account permissions may become too broad or too narrow
- workflow secrets and repository variables may drift from the documented setup

The repository should document required GitHub secrets, variables, and GCP IAM roles explicitly.

## POC Build Order

Build in this order:

1. shared report payload contract
2. Cloud Logging fetcher
3. raw log normalizer
4. Agent8 message parser
5. run correlation
6. bottleneck classifier
7. timeout classifier
8. validate parser and correlation behavior against `d:\work\planetarium\2025\mcp-agent8`
9. snapshot report builder
10. GitHub Pages static report
11. real-time API using the same core modules
12. switch the UI data source from static JSON to API only when needed

## Acceptance Criteria

The first POC is successful if it can:

- query Cloud Logging for one Cloud Run service
- detect runs for all four target flows
- distinguish queue timeout vs handoff vs provider failure
- merge `requestId`-only status/result follow-up logs into the original run when possible
- identify the dominant stage in each run
- produce a machine-readable JSON snapshot report
- render a human-readable externally shareable static summary page
- clearly show `generatedAt`, `coveredFrom`, and `coveredTo`
- keep the parsing, correlation, classification, and report payload reusable for a later real-time backend

## External References

- Cloud Logging `entries.list`: https://cloud.google.com/logging/docs/reference/v2/rest/v2/entries/list
- Cloud Logging entries resource: https://cloud.google.com/logging/docs/reference/v2/rest/v2/entries
- Logging query language: https://cloud.google.com/logging/docs/view/logging-query-language
- Cloud Run logging: https://cloud.google.com/run/docs/logging
- Cloud Logging monitored resources: https://cloud.google.com/logging/docs/api/v2/resource-list
- GitHub Pages overview: https://docs.github.com/en/pages/getting-started-with-github-pages
- GitHub Pages static hosting overview: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Git.io no longer accepts new URLs: https://github.blog/changelog/2022-01-11-git-io-no-longer-accepts-new-urls/
- Vercel Functions overview: https://vercel.com/docs/functions
- GitHub coding agents overview: https://docs.github.com/en/copilot/concepts/agents/about-third-party-agents
- GitHub OpenAI Codex agent: https://docs.github.com/en/copilot/concepts/agents/openai-codex
- Google GitHub Actions auth: https://github.com/google-github-actions/auth

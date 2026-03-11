# agent8-mcp-logger

Static snapshot log inspector POC for Agent8 Cloud Run logs.

## Current Goal

Phase 1 delivers an externally shareable static report on GitHub Pages.

- a local script or GitHub Actions job queries Cloud Logging
- the snapshot pipeline parses, correlates, and classifies Agent8 runs
- generated artifacts are published from `site/`

The code is intentionally structured so phase 2 can switch to a real-time backend without rewriting the core logic.

## Project Shape

- `src/adapters/`: external I/O such as Cloud Logging
- `src/parsing/`: normalization and Agent8 log parsing
- `src/domain/`: correlation and classification
- `src/reporting/`: report assembly
- `src/contracts/`: report payload contracts shared by snapshot and future API modes
- `scripts/build-snapshot.ts`: phase-1 snapshot entry point
- `site/`: static GitHub Pages output

## Local Usage

1. Install dependencies:

```bash
npm install
```

2. Build a sample snapshot:

```bash
npm run snapshot:build
```

3. Open `site/index.html` with any static file server.

If `SNAPSHOT_SOURCE` is omitted, the script uses sample data unless enough GCP parameters are present to query Cloud Logging.

## Snapshot Environment Variables

- `SNAPSHOT_SOURCE`: `sample` or `gcp`
- `SNAPSHOT_PROJECT_ID`
- `SNAPSHOT_SERVICE_NAME`
- `SNAPSHOT_LOCATION`
- `SNAPSHOT_FROM`
- `SNAPSHOT_TO`
- `SNAPSHOT_LIMIT`
- `SNAPSHOT_TOOL_FLOWS`
- `SNAPSHOT_OUTPUT_DIR`

If `SNAPSHOT_FROM` and `SNAPSHOT_TO` are omitted, the script defaults to the last 24 hours.

## GitHub Actions Setup

The included workflow publishes the `site/` directory to GitHub Pages.

Repository:

- GitHub repo: `https://github.com/dinoksb/agent8-mcp-logger.git`
- default GCP project: `agent8-455106`
- default Cloud Run service: `agent8-image-mcp-server`

Recommended repository variables:

- `SNAPSHOT_SOURCE`
- `SNAPSHOT_PROJECT_ID=agent8-455106`
- `SNAPSHOT_SERVICE_NAME`
- `SNAPSHOT_LOCATION`
- `SNAPSHOT_LIMIT`
- `SNAPSHOT_TOOL_FLOWS`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Fallback secret only if federation is not ready:

- `GCP_SERVICE_ACCOUNT_KEY`

Recommended auth order:

1. Workload Identity Federation
2. read-only service account key only as a temporary fallback

Recommended phase-1 repository variable set:

- `SNAPSHOT_SOURCE=gcp`
- `SNAPSHOT_PROJECT_ID=agent8-455106`
- `SNAPSHOT_SERVICE_NAME=agent8-image-mcp-server`
- `SNAPSHOT_LOCATION=<your Cloud Run region>`
- `SNAPSHOT_LIMIT=1000`

The workflow also supports manual `workflow_dispatch` inputs for:

- `snapshot_source`
- `snapshot_from`
- `snapshot_to`
- `snapshot_limit`

If GCP auth or Cloud Run identifiers are not configured yet, keep `SNAPSHOT_SOURCE=sample` so GitHub Pages still publishes a demo snapshot instead of failing.

## GCP Auth Recommendation

Use `Workload Identity Federation through a Service Account`.

- no long-lived JSON key stored in GitHub
- easy to restrict to `dinoksb/agent8-mcp-logger`
- easy to reuse later when phase 2 moves to a real-time backend

Use a service account key only as a temporary fallback.

Detailed setup steps are in [docs/github-actions-gcp-wif-setup.md](/d:/work/planetarium/agent8/agent8-mcp-logger/docs/github-actions-gcp-wif-setup.md).

## Coding Agent Usage

GitHub coding agents such as Codex should be used for repository work:

- PR creation
- parser updates
- classifier reviews
- docs maintenance

They should not be used as the runtime path for fetching Cloud Logging data.

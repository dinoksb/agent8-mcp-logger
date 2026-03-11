# PROJECT

## Overview

`agent8-mcp-logger` is a TypeScript proof-of-concept that inspects Agent8 Cloud Run logs and produces an operational report.

## Phase 1

Phase 1 publishes a fixed-time snapshot report to GitHub Pages.

- Cloud Logging access happens in a script or CI job
- parsing, correlation, classification, and report generation stay in shared modules
- the static site consumes generated JSON artifacts

## Phase 2

Phase 2 adds a real-time backend without changing the core report contract.

- reuse the same adapters, parsing, domain, and reporting modules
- return the same payload shape over HTTP
- move the frontend data source from static JSON to API responses

## Source System

The source-of-truth implementation to inspect is:

- `d:\work\planetarium\2025\mcp-agent8`

## Success Criteria

- detect all four Agent8 target flows
- identify bottlenecks by stage
- distinguish queue timeout, handoff, and provider failure
- publish an externally shareable report quickly


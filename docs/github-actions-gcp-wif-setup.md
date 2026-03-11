# GitHub Actions GCP WIF Setup

This repository should use `Workload Identity Federation through a Service Account`.

Target repository:

- `dinoksb/agent8-mcp-logger`

Target project:

- `agent8-image-mcp-server`

## Why This Is Recommended

- GitHub Actions can read Cloud Logging without storing a long-lived service account key
- access can be restricted to this repository
- the same auth model can be reused later for a real-time backend

Use a JSON key only if WIF setup is blocked and you need a temporary fallback immediately.

## Required GCP Roles

Create a dedicated service account for GitHub Actions and start with:

- `roles/logging.viewer`

If the target logs are private and `roles/logging.viewer` is not enough, add:

- `roles/logging.privateLogViewer`

Only add the second role if the first one proves insufficient.

## Suggested Resource Names

These names are safe defaults for this repo:

- Workload Identity Pool: `github`
- Workload Identity Provider: `agent8-mcp-logger`
- Service Account ID: `agent8-mcp-logger-gha`

## Setup Commands

Run these with `gcloud` authenticated to the target project.

```bash
PROJECT_ID="agent8-image-mcp-server"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")"
REPO="dinoksb/agent8-mcp-logger"
POOL_ID="github"
PROVIDER_ID="agent8-mcp-logger"
SERVICE_ACCOUNT_ID="agent8-mcp-logger-gha"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
```

Create the service account:

```bash
gcloud iam service-accounts create "${SERVICE_ACCOUNT_ID}" \
  --project="${PROJECT_ID}" \
  --display-name="agent8-mcp-logger GitHub Actions"
```

Grant Cloud Logging read access:

```bash
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/logging.viewer"
```

If needed later, add private log access:

```bash
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/logging.privateLogViewer"
```

Create the Workload Identity Pool:

```bash
gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions pool"
```

Create the OIDC provider for this repository:

```bash
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="agent8-mcp-logger GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${REPO}' && assertion.ref == 'refs/heads/main'"
```

Allow this repository to impersonate the service account:

```bash
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"
```

Get the full provider resource name:

```bash
gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --format="value(name)"
```

## GitHub Repository Settings

Set these repository variables in GitHub:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - Example shape: `projects/123456789/locations/global/workloadIdentityPools/github/providers/agent8-mcp-logger`
- `GCP_SERVICE_ACCOUNT`
  - Example: `agent8-mcp-logger-gha@agent8-image-mcp-server.iam.gserviceaccount.com`
- `SNAPSHOT_SOURCE`
  - `gcp`
- `SNAPSHOT_PROJECT_ID`
  - `agent8-image-mcp-server`
- `SNAPSHOT_SERVICE_NAME`
  - your Cloud Run service name
- `SNAPSHOT_LOCATION`
  - your Cloud Run region
- `SNAPSHOT_LIMIT`
  - `1000`

Optional variables:

- `SNAPSHOT_TOOL_FLOWS`
  - comma-separated list such as `image_asset_generate,image_variation_generate,spritesheet_generate,spritesheet_variation_generate`
- `SNAPSHOT_FROM`
- `SNAPSHOT_TO`

## Temporary Fallback

If WIF is blocked, use a short-lived fallback:

1. create a service account key for the same service account
2. store it in GitHub secret `GCP_SERVICE_ACCOUNT_KEY`
3. remove it after WIF is working

Do not keep the key path as the long-term configuration.

## What Still Needs Your Input

This repository is already wired for:

- GitHub Pages deployment
- GitHub Actions snapshot publishing
- WIF-based auth

You still need to decide and configure:

- `SNAPSHOT_SERVICE_NAME`
- `SNAPSHOT_LOCATION`

Without those two values, the workflow should stay on `sample` mode.

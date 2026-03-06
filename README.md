# mergeX Frontend

Frontend for GitHub repo fetch + install flow.

## What this app does

- Accepts a GitHub repo URL (`owner/repo` or full URL)
- Calls backend to fetch repository metadata, issues, pull requests, and file tree
- If the GitHub App is not installed on that repo, shows an install button
- Redirects to GitHub App install page and returns to `/add-repo`
- Auto-fetches again after installation

## Prerequisites

- Node.js 20+
- Backend running from `../mergeX-backend`
- A GitHub App created and configured

## GitHub App settings

Use these values for local development:

- `Homepage URL`: `http://127.0.0.1:8081`
- `Setup URL`: `http://127.0.0.1:8081/add-repo`
- `Request user authorization (OAuth) during installation`: `OFF`
- `Webhook`: optional for this flow (can be `OFF`)

Repository permissions needed:

- `Metadata`: Read-only
- `Contents`: Read-only
- `Issues`: Read-only
- `Pull requests`: Read-only

## Run frontend

```bash
cd mergeX
npm install
npm run dev -- --host 127.0.0.1 --port 8081
```

Open:

- `http://127.0.0.1:8081`
- `http://127.0.0.1:8081/add-repo`

## Backend env

Backend must provide:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (full PEM, not SHA256 fingerprint)
- `GITHUB_APP_SLUG`
- `GITHUB_APP_INSTALL_URL`

See backend sample env in:

- `../mergeX-backend/.env.example`

## Install flow in UI

1. Paste repo URL and click `Fetch Repo Data`
2. If not installed, click `Install GitHub App and Return`
3. Complete install on GitHub
4. GitHub returns to `/add-repo`
5. App auto-retries fetch

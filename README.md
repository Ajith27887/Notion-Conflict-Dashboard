# Concord — Notion Conflict Dashboard

Concord is a multi-tenant web app that connects to a Notion workspace, watches the
pages in it, and surfaces **edit conflicts** — moments where two different people
changed the same block around the same time. Each conflict is shown side-by-side
(User 1's version next to User 2's version) so a team member can pick a winner. The
chosen version is written **back into the actual Notion block**, not just recorded
in the dashboard.

## What it does

- **Connect with Notion** — OAuth flow; each user's profile and access token are stored per workspace.
- **Sync** — pulls the workspace's pages and per-block snapshots, automatically every ~60s and on-demand via a **Sync Now** button.
- **Detect conflicts** — when a block's content changes between snapshots and is attributed to two different Notion editors, a conflict is recorded with the previous and new versions.
- **Resolve** — **Keep User 1** / **Keep User 2** buttons resolve the conflict, record who resolved it and when, and push the chosen content back to Notion.
- **Dashboard** — summary cards (total / resolved / unresolved / most active page), a list of connected pages with last-synced times, and live-updating conflicts.

See [FEATURES.md](./FEATURES.md) for the full, per-feature status.

## Architecture

| Piece | Stack | Port |
|-------|-------|------|
| **Frontend** | Next.js 16 (App Router, React 19) in `app/` | `http://localhost:3000` |
| **Backend** | Express 5 (`server/`) — handles Notion OAuth, sync scheduler, conflict detection, write-back | `http://localhost:3001` |
| **Database** | Postgres via Prisma 7 (`prisma/schema.prisma`) | — |

This is a **two-package repo**: the root `package.json` (Next.js app) and
`server/package.json` (Express server) each have their own `node_modules`. The
Prisma client is generated to `app/generated/prisma` and shared by both.

Core data models (`prisma/schema.prisma`): `User`, `Page`, `Snapshot`, `Conflict`.

## Getting started

### Prerequisites

- Node.js 20+
- A reachable Postgres database
- A Notion integration (OAuth client id/secret)

### 1. Configure environment

Create a `.env` file at the repo root (git-ignored — **never commit it**). Required keys:

```bash
CLIENT_ID=            # Notion OAuth client id
JWT_SECERCT=          # secret used to sign session tokens
NOTION_WEBHOOK_TOKEN= # verification token for Notion webhooks
DATABASE_URL=         # Postgres connection string (pooled)
DIRECT_URL=           # Postgres direct connection (migrations)
NEXT_PUBLIC_API_URL=  # base URL of the Express backend, e.g. http://localhost:3001
AUTH_SHARED_SECRET=   # shared secret between frontend and backend
APP_BASE_URL=         # base URL of the frontend, e.g. http://localhost:3000
```

### 2. Install, generate, and smoke-check

```bash
./init.sh
```

`init.sh` installs both packages, runs `npx prisma generate`, checks Postgres
reachability, and runs a behavioral smoke check (boots both servers, verifies the
OAuth redirect and login page, then tears down).

### 3. Run the app

Start the backend and frontend in two terminals:

```bash
# Terminal 1 — Express backend (port 3001)
npm --prefix server run start

# Terminal 2 — Next.js frontend (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Continue with Notion**.

## Useful scripts

**Frontend (root):**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | `prisma generate` + `next build` |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |

**Backend (`server/`):**

| Command | Description |
|---------|-------------|
| `npm --prefix server run start` | Start the Express server |
| `npm --prefix server run sync` | Run a one-off sync |
| `npm --prefix server run detect-conflicts` | Run conflict detection once |
| `npm --prefix server run cleanup-bot-conflicts` | Clean up conflicts caused by the app's own write-backs |

## Verification

There is no unit test suite. Verification is **behavioral** — the baseline smoke
check in `init.sh` must pass: Prisma generates, both servers boot, `GET /auth/`
on the backend returns a 302 to Notion's authorize screen, and `GET /` on the
frontend returns 200. Per-feature verification steps live in `feature_list.json`.

## Repository conventions

This repo is set up for long-running coding-agent work. The canonical entry point
for how to work in it is [AGENTS.md](./AGENTS.md) (referenced by `CLAUDE.md`). Key
artifacts:

- [`AGENTS.md`](./AGENTS.md) — operating loop, rules, verification, definition of done
- `feature_list.json` — source of truth for feature state
- `claude-progress.md` — session log and current verified status
- `FEATURES.md` — human-readable feature status summary

## Deployment

Target deployment (in progress, see `deploy-002`): frontend on Vercel, backend on
Render, database on Supabase. Note: the Vercel build must run `prisma generate`
(the generated client is git-ignored), which the `build` script handles.

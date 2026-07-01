# AGENTS.md

This repository (**Concord** — a Notion Conflict Dashboard) is designed for
long-running coding-agent work. The goal is not to maximize raw code output. The goal
is to leave the repo in a state where the next session can continue without guessing.

## Project Shape

- **Frontend**: Next.js 16 app (`app/`), served on `http://localhost:3000`.
- **Backend**: Express server (`server/`), served on `http://localhost:3001`, handles
  Notion OAuth. Started with `tsx --env-file=../.env`.
- **Data**: Prisma + Postgres (`prisma/schema.prisma`); generated client output goes to
  `app/generated/prisma`.
- **Two packages**: root `package.json` and `server/package.json` (two `node_modules`).
- **No unit test suite yet** — verification is a behavioral smoke check (see below).

## Startup Workflow

Before writing code:

1. Confirm the working directory with `pwd` (expect the repo root).
2. Read `claude-progress.md` for the latest verified state and next step.
3. Read `feature_list.json` and choose the highest-priority unfinished feature.
4. Review recent commits with `git log --oneline -5`.
5. Run `./init.sh` (installs both packages, runs `npx prisma generate`, runs the
   baseline smoke check).
6. Confirm the baseline smoke check passed before starting new work.

If baseline verification is already failing, fix that first. Do not stack new
feature work on top of a broken starting state.

## Working Rules

- Work on one feature at a time (the highest-priority unfinished feature).
- Do not mark a feature complete just because code was added.
- Keep changes within the selected feature scope unless a blocker forces a
  narrow supporting fix.
- Do not silently change verification rules during implementation.
- Prefer durable repo artifacts over chat summaries.
- Do not commit code changes until the maintainer has reviewed them. Implement the
  feature, run verification, update the artifacts, then stop and wait for review —
  commit only after the maintainer approves. (Applies from feature `sync-001` onward.)
- Never commit secrets. `.env` holds the Notion client id/secret and must stay
  git-ignored; do not echo its values into logs or committed files.

## Required Artifacts

- `feature_list.json`: source of truth for feature state
- `claude-progress.md`: session log and current verified status
- `init.sh`: standard startup and verification path
- `session-handoff.md`: optional compact handoff for larger sessions
- `clean-state-checklist.md`, `evaluator-rubric.md`, `quality-document.md`: review aids

## Verification (What "Passing" Means Here)

There is no unit test suite, so verification is **behavioral**. The baseline smoke
check (run by `./init.sh`) does the following and must all succeed:

1. `npx prisma generate` succeeds and Postgres (`DATABASE_URL` in `.env`) is reachable.
2. Boots the Express server (3001) and Next dev server (3000).
3. `GET http://localhost:3001/auth/` returns **302** redirecting to
   `api.notion.com/v1/oauth/authorize`.
4. `GET http://localhost:3000/` returns **200** (login page renders).
5. Both processes are torn down, leaving a clean state.

Per-feature `verification` steps in `feature_list.json` extend this with the specific
behavior for that feature.

## Definition Of Done

A feature is done only when all of the following are true:

- the target behavior is implemented
- the required verification actually ran
- evidence is recorded in `feature_list.json` or `claude-progress.md`
- the repository remains restartable from the standard startup path (`./init.sh`)

## End Of Session

Before ending a session:

1. Update `claude-progress.md`.
2. Update `feature_list.json`.
3. Record any unresolved risk or blocker.
4. Wait for maintainer review, then commit with a descriptive message once the work
   is in a safe state and approved (see Working Rules — do not commit before review).
5. Leave the repo clean enough for the next session to run `./init.sh` immediately.

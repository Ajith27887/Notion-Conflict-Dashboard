# Progress Log

## Current Verified State

- Repository root: `/home/ajith/personal/Notion-Conflict-Dashboard`
- Standard startup path: `./init.sh`
- Standard verification path: behavioral smoke check inside `./init.sh` — boots the
  Express server (3001) and Next dev (3000), asserts `GET /auth/` → 302 to
  `api.notion.com/v1/oauth/authorize` and `GET /` → 200, then tears both down.
- Current highest-priority unfinished feature: `sync-002` (60-second polling snapshot
  engine). `auth-001`, `auth-002`, `dash-001`, `auth-003`, `sync-001`, `conflict-001`,
  and `conflict-002` are `passing`.
- Current blocker: none. `conflict-002` implemented and verified (Dashboard renders
  seeded resolved/unresolved conflicts with status and resolvedBy); awaiting maintainer
  review before commit.

## Session Log

### Session 006

- Date: 2026-07-02
- Goal: Implement `conflict-002` — dashboard lists conflicts with status and resolver.
- Completed: Added `app/lib/prisma.ts` — a `PrismaClient` for the Next.js app (the only
  prior instance, `server/PrismaClient.ts`, is Express-only). Same adapter pattern
  (`@prisma/adapter-pg` + `pg.Pool` against `DATABASE_URL`, already root-level deps),
  cached on `globalThis` outside production so Next dev's hot-reload doesn't leak a new
  `pg.Pool` per edit. `DATABASE_URL` needed no extra wiring — Next.js auto-loads `.env`
  from the project root (unlike the Express side's `--env-file=../.env`). Made
  `app/Dashboard/page.tsx` an async server component that queries
  `prisma.conflict.findMany` (ordered by `createdAt` desc, including `page`/`user1`/
  `user2`) and renders one card per conflict: page title (falls back to `blockId`), a
  status badge (amber=unresolved/green=resolved), both users, and "Resolved by:
  `<resolvedBy>`" (`—` when `resolvedBy` is `""`, the placeholder `conflict-001` writes
  for unresolved rows). Kept the original empty state when there are zero conflicts.
  Stayed a server component (no `"use client"`) on purpose so the list renders into the
  initial HTML — no dependency on `GET /conflicts` (`conflict-003`, still not built),
  matching the feature's own note.
- Risk check (no bundler workaround needed): the plan flagged Prisma's pg driver
  adapter (wasm query compiler + `pg`) as a known friction point inside Next 16's
  server-component bundling. Verified directly by loading the page — it worked with no
  config changes; the anticipated `serverExternalPackages` fallback in `next.config.ts`
  was not needed.
- False-alarm network check: before seeding, a raw `bash /dev/tcp/db.prisma.io/5432`
  probe (both inside and outside the Bash sandbox) failed/hung, which looked like a
  blocking DB-reachability issue. It wasn't — Node's own `pg` connection from inside a
  running Next/Express process connected fine (confirmed by the empty-state page
  rendering correctly against the live DB before any seeding). Bash's `/dev/tcp` is not
  a reliable reachability probe in this environment; don't trust it over an actual
  in-process connection attempt next time.
- Self-caught verification bug: the first seed+curl pass reused a shell whose cwd was
  still `server/` (left over from `cd server && npx tsx ...`), so `npm run dev`
  silently ran against `server/package.json` (no `dev` script there) and failed with
  "Missing script: dev" — the `curl` that returned 200 was actually served by a
  leftover dev-server process from an earlier probe, not by the command the draft
  evidence claimed. Caught this before recording it as evidence (via the advisor
  check), not after. Redid the whole verification cleanly: killed every stray `next
  dev`/`next-server` process and `.next/dev/lock`, re-seeded, ran `npm run dev` from
  the confirmed repo root, and this time confirmed from the **server's own log**
  (`GET /Dashboard 200 in ...`) that the run under test actually handled the request.
  Lesson for later sessions: after any `cd` into `server/`, either `cd` back
  explicitly or run the next command in a subshell — don't assume cwd resets.
- Verification run (corrected/clean pass): (1) DB before seeding: 1 `User`, 4 `Page`s,
  0 `Conflict`s (matches `conflict-001`'s post-cleanup state). (2) Seeded a synthetic
  second `User` (`conflict-002-test-user2@example.com`, same `workspaceId` as the real
  user) and two `Conflict` rows against a real `pageId` via a one-off script (not
  committed, same pattern as `conflict-001`): one `status='resolved'` with a
  **non-empty** `resolvedBy` (`conflict-002-test-resolver@example.com` — a
  `resolvedBy=''` seed would have made "verify the resolvedBy value" vacuous) and one
  `status='unresolved'` with `resolvedBy=''` (to exercise the `—` fallback).
  (3) `npm run dev` from repo root, then `curl http://localhost:3000/Dashboard` →
  **HTTP 200**, confirmed served by the run under test via its own access log; response
  body confirmed (via grep) to contain both seeded `blockId`s, both status strings with
  correct badge colors, the resolver email, the "Resolved by" label, the em-dash
  fallback, and both users' names. (4) Cleanup: deleted both seeded `Conflict` rows and
  the synthetic test `User` via the same one-off script's cleanup counterpart; DB
  confirmed restored to 1 `User`, 4 `Page`s, 0 `Conflict`s. (5) Stopped the dev server
  and confirmed no process is listening on 3000/3001. (6) `./init.sh` baseline smoke
  check re-run after cleanup: PASSES (`/auth/` → 302, `/` → 200, "Postgres reachable"
  this time — the earlier reachability warning in this session was transient/unrelated
  to the app). (7) `npx tsc --noEmit` clean. (8) Also cleaned up two stray dev
  processes left over from an earlier `./init.sh` run this session whose `EXIT` trap
  hadn't fully torn down the process tree — a pre-existing `init.sh` cleanup gap, not
  introduced by this feature and not fixed here (flagged in `feature_list.json` notes).
- Evidence captured: recorded in `feature_list.json` under `conflict-002.evidence`
  (includes the cwd-bug correction, so the record matches what actually ran).
- Commits: none yet (change staged for maintainer review per `AGENTS.md` working
  rules). Note: `conflict-001` was already committed and pushed (`a11c5d2`) before this
  session started — an earlier draft of this log incorrectly described it as still
  pending review; corrected here.
- Files or artifacts updated: `app/lib/prisma.ts` (new), `app/Dashboard/page.tsx`
  (modified), `feature_list.json`, `claude-progress.md`. The seeded test `User` and two
  `Conflict` rows, and the one-off seed/cleanup scripts used to create/remove them,
  were all deleted after verification — nothing test-only was left in the repo or DB.
- Known risk or unresolved issue: (1) carries forward `conflict-001`'s MVP limitation
  that `resolvedBy=''` (not `null`) represents "not yet resolved" — the UI now
  explicitly treats empty string as that case and renders `—`. (2) NEW, unfixed on
  purpose: `app/Dashboard/page.tsx` does an uncached Prisma read in a server component
  with no dynamic-rendering marker. `next dev` renders per-request, so this session's
  verification is legitimately green, but `next build` (needed for `deploy-002`) may
  try to statically prerender this route — which could bake in build-time data or fail
  if the DB isn't reachable at build time. No build step is exercised by this repo's
  verification yet, so adding `export const dynamic = 'force-dynamic'` now would be
  speculative; flag it before `deploy-002`. Every later feature extending this same
  page (`sync-003`, `dash-002`, `dash-003`, `conflict-005`) inherits this same risk.
  (3) `init.sh`'s `EXIT` trap doesn't reliably kill its full process tree (observed
  twice this session) — worth a look before running it unattended.
- Next best step: maintainer reviews the `conflict-002` diff; then start `sync-002` —
  60-second polling snapshot engine (next unfinished feature by priority).

### Session 005

- Date: 2026-07-02
- Goal: Implement `conflict-001` — detect concurrent edits and record Conflict rows.
- Completed: Added `server/lib/conflict.ts` exporting `detectConflicts()` — the
  reusable detection routine. It reads all `Snapshot` rows ordered by `createdAt`,
  groups them by `blockId`, and per block keeps each distinct user's latest snapshot.
  Blocks with 2+ distinct contributors get a `Conflict` row: the two earliest-by-
  latest-touch contributors become `user1Id`/`user2Id`, `pageId`/`blockId` come from
  their snapshots, `status: "unresolved"`, `resolvedBy: ""` (placeholder — the column
  is non-null with no default; chose this over a nullable migration to keep the
  feature at zero schema changes). Before creating, it checks for an existing
  `Conflict` on that `blockId` + user pair (either order) and skips if found, so
  repeated runs don't create duplicates. Added the thin trigger
  `server/scripts/runDetectConflicts.ts` (mirrors `runSync.ts`) and a
  `detect-conflicts` npm script in `server/package.json`. `sync-002`/`sync-004` can
  call `detectConflicts()` directly once they exist.
- Decision (status value): `conflict-001`'s own verification text originally said
  `status='open'`, but `conflict-003`, `conflict-004`, `conflict-005`, and
  `ALL_PHASE.md` all use `'unresolved'`/`'resolved'`. Writing `'open'` would have made
  detected conflicts invisible to `GET /conflicts` and the dashboard later. Asked the
  maintainer via AskUserQuestion during planning; no response arrived in time, so
  proceeded with `'unresolved'` (4 entries vs. 1) and updated `conflict-001`'s
  verification text accordingly — a documented change, not a silent one. Also updated
  `conflict-003`'s note to drop the now-resolved DISCREPANCY flag. Flagged for
  maintainer to confirm or override on review.
- Scope notes: no schema change (Conflict model already had every needed column); did
  not add `Snapshot.content` (that's `conflict-005`'s requirement, out of scope here).
  Detection is presence-based only — `Snapshot.userId` records who *synced* a block,
  not who *edited* it in Notion (no `last_edited_by`/`last_edited_time` captured) — and
  has no time window (any two contributors ever seen on a block count) and no
  pairwise-for-3+-contributors handling (only the earliest pair is flagged). All
  recorded as known MVP limitations.
- Verification run: (1) DB before: 1 `User` (id 1), 129 `Snapshot` rows (all
  `userId=1`), 0 `Conflict` rows. (2) Seeded a synthetic second `User` (id 6,
  `conflict-001-test-user2@example.com`, same `workspaceId` as user 1) and one
  `Snapshot` (id 130) on an existing `blockId`
  (`3267f940-ff25-80ce-8952-fd1adad9c443`)/`pageId` (1) with `userId=6`. (3) Ran
  `npm run detect-conflicts` → "Conflict detection complete: 1 conflict(s) created.";
  DB confirmed the row (`pageId=1`, matching `blockId`, `user1Id=1`, `user2Id=6`,
  `status='unresolved'`, `resolvedBy=''`). (4) Re-ran the same command → "0
  conflict(s) created"; `Conflict` count stayed at 1 — dedup confirmed. (5) `./init.sh`
  baseline smoke check PASSES (`/auth/` → 302, `/` → 200). (6) Cleanup: deleted the
  seeded `Conflict` (id 1), `Snapshot` (id 130), and test `User` (id 6) rows in FK
  order after verification — the test user shared the real `workspaceId`, so leaving
  it would have shown up as a real teammate/conflict in `team-001`/`dash-002`/
  `dash-004` later. DB confirmed restored: 1 `User`, 129 `Snapshot` rows, 0 `Conflict`
  rows.
- Evidence captured: recorded in `feature_list.json` under `conflict-001.evidence`.
- Commits: none yet (change staged for maintainer review per AGENTS.md working rules).
- Files or artifacts updated: `server/lib/conflict.ts` (new),
  `server/scripts/runDetectConflicts.ts` (new), `server/package.json`,
  `feature_list.json` (`conflict-001` + `conflict-003` note), `claude-progress.md`.
  The seeded test `User` (id 6), `Snapshot` (id 130), and resulting `Conflict` (id 1)
  rows were deleted after verification (maintainer confirmed via AskUserQuestion) —
  the DB is back to its pre-verification state. `conflict-002`/`conflict-003`/
  `conflict-004` will each need to seed their own `Conflict` row for their own
  verification.
- Known risk or unresolved issue: the `'unresolved'` status decision was made without
  maintainer confirmation (no response to the AskUserQuestion prompt in time) — flag
  this specifically during review. Presence-based detection means any two users who
  have ever both touched a block will be flagged, with no recency check; acceptable
  for MVP per the verification as written, but worth revisiting once Notion edit
  metadata is available.
- Next best step: maintainer reviews the diff (and confirms/overrides the status-value
  decision); then start `conflict-002` — dashboard lists conflicts with status and
  resolver (extends `app/Dashboard/page.tsx`).

### Session 004

- Date: 2026-07-01
- Goal: Implement `sync-001` — fetch and snapshot Notion pages/blocks per workspace.
- Completed: Added `server/lib/sync.ts` exporting `syncWorkspaceForUser(user)` — the
  durable, reusable sync routine. It builds an authenticated Notion client from the
  user's stored `accessToken` (auth-003), searches pages, upserts a `Page` per page on
  the stable `notionPageId` (title from the title-type property, fallback "Untitled";
  `workspaceId` from the user), then lists each page's top-level blocks and creates a
  `Snapshot { blockId, pageId, userId }` per block. The per-page block is wrapped in
  try/catch and continues on error so a duplicate `tittle` (Page.tittle is `@unique`)
  can't abort the run. Token is never logged; returns `{ pages, snapshots }` counts.
  Added a thin trigger `server/scripts/runSync.ts` + a `sync` npm script in
  `server/package.json` (`tsx --env-file=../.env scripts/runSync.ts`) that resolves the
  first user with a non-null accessToken and calls the routine. sync-002 (interval) and
  sync-004 (POST /sync) will reuse the same routine — deliberately not built here.
- Scope note: no schema change, no new dependency. MVP limitations left for later: no
  pagination, no recursion into nested blocks, no block content stored (Snapshot has no
  content column — conflict-001 owns adding it), single-user token.
- Verification run: (1) `./init.sh` baseline smoke check still PASSES (`/auth/` → 302,
  `/` → 200; `npx prisma generate` OK). (2) `npm run sync` against connected workspace
  `ddb7f940…` (user id 1) → "Sync complete: 4 page(s) upserted, 86 snapshot(s) created"
  (token not logged). (3) DB assertions: 4 `Page` rows with `notionPageId`/`tittle`/
  `workspaceId` populated; 86 `Snapshot` rows linking `blockId`/`pageId`/`userId`.
- Evidence captured: recorded in `feature_list.json` under `sync-001.evidence`.
- Commits: none yet (change staged for maintainer review per AGENTS.md working rules).
- Files or artifacts updated: `server/lib/sync.ts` (new), `server/scripts/runSync.ts`
  (new), `server/package.json`, `feature_list.json`, `claude-progress.md`.
- Known risk or unresolved issue: `Page.tittle` is `@unique`, which is a schema smell for
  page titles (two same-titled pages would skip the second); handled defensively for now.
- Next best step: `conflict-001` — detect concurrent edits and record Conflict rows.
  Note its schema prep (add `Snapshot.content` and reconcile `Conflict.resolvedBy`
  nullability / `status` value 'open' vs 'unresolved').

### Session 001

- Date: 2026-07-01
- Goal: Set up the harness-engineering scaffolding for the repo.
- Completed: Created `AGENTS.md` (canonical), `CLAUDE.md` (pointer), `feature_list.json`
  (seeded with Concord's real features), `init.sh` (two-package install + Prisma
  generate + behavioral smoke check), `claude-progress.md`, `session-handoff.md`,
  `clean-state-checklist.md`, `evaluator-rubric.md`, `quality-document.md`.
- Verification run: `./init.sh` (installs both packages, `npx prisma generate`, smoke
  check) and `python3 -m json.tool feature_list.json`.
- Evidence captured: See init.sh output and feature `auth-001` evidence.
- Commits: none yet (harness files staged for review).
- Files or artifacts updated: all harness files listed above.
- Known risk or unresolved issue: smoke check requires a reachable Postgres via `.env`
  for full app function, though the two smoke assertions themselves do not hit the DB.
  `auth-002` callback bug is recorded, not fixed.
- Next best step: pick up `auth-002` — fix the double-response in the OAuth callback and
  verify a single 302 to `/Dashboard` plus a User upsert.

### Session 002

- Date: 2026-07-01
- Goal: Implement in-progress feature `auth-002` (OAuth callback single response + redirect).
- Completed: Fixed the double-send in `server/api/auth.ts` — the success branch now does
  `return res.redirect("http://localhost:3000/Dashboard")` only (removed the trailing
  `res.json`). No other lines changed.
- Verification run: (1) `./init.sh` baseline smoke check still passes. (2) `GET /auth/callback`
  with no code → HTTP 400; `GET /auth/callback?code=bogus` → HTTP 400; **0** occurrences of
  `ERR_HTTP_HEADERS_SENT` in the server log.
- Evidence captured: recorded in `feature_list.json` under `auth-002.evidence`.
- Commits: none yet (change staged for review).
- Files or artifacts updated: `server/api/auth.ts`, `feature_list.json`, `claude-progress.md`,
  `session-handoff.md`.
- Known risk or unresolved issue: the success path (real Notion login → 302 to `/Dashboard`
  → User upsert) has not been exercised because it needs a valid Notion authorization code
  from a browser login. `auth-002` stays `in_progress` until that manual run is recorded.
- Next best step: perform the manual OAuth login once, record the 302 + upsert evidence and
  flip `auth-002` to `passing`; then start `dash-001` (create the `/Dashboard` route so the
  redirect lands on a real page).
- Update: manual OAuth run confirmed (single 302 to `/Dashboard`, User upsert correct).
  `auth-002` flipped to `passing`. Next feature is `dash-001`.

### Session 003

- Date: 2026-07-01
- Goal: Implement `dash-001` — add the `/Dashboard` route so the post-login redirect
  lands on a real page (200) instead of a 404.
- Completed: Added `app/Dashboard/page.tsx` — a server component (no `"use client"`, no
  data fetching) rendering the dashboard shell (header + placeholder region), matching the
  Tailwind idiom in `app/page.tsx`. Folder is capital-`D` `app/Dashboard/` to match the
  exact redirect target confirmed in `server/api/auth.ts:81`. No other files changed.
- Scope note: shell only. Listing conflicts is `conflict-002` (extends this file later,
  after `conflict-001`). No auth gate added — the dash-001 verification curls `/Dashboard`
  with no session and expects 200.
- Verification run: (1) `./init.sh` baseline smoke check still PASSES (`/auth/` → 302,
  `/` → 200). (2) `npm run dev`, then `curl http://localhost:3000/Dashboard` → **HTTP 200**
  (was 404); body contains the shell copy "Edit conflicts detected across your Notion
  workspace." Dev server torn down (port 3000 → 000), clean state.
- Evidence captured: recorded in `feature_list.json` under `dash-001.evidence`.
- Commits: pending (`feat(dashboard): add /Dashboard shell route (dash-001)`).
- Files or artifacts updated: `app/Dashboard/page.tsx` (new), `feature_list.json`,
  `claude-progress.md`.
- Known risk or unresolved issue: none.
- Next best step: `sync-001` — fetch and snapshot Notion pages/blocks per workspace
  (Prisma `Page`/`Snapshot` models already exist).

### Session 004

- Date: 2026-07-01
- Goal: Implement `auth-003` — persist the Notion access token on the User during the
  OAuth callback (prep for `sync-001`).
- Completed: (1) Added `accessToken String?` to the `User` model in
  `prisma/schema.prisma`. (2) Updated the `prisma.user.upsert` in `server/api/auth.ts` to
  write `accessToken: AccessToken` (i.e. `response.access_token`) in both the `create` and
  `update` blocks; the success `console.log` still omits the token.
- Migration drift handled (data-loss guard worked): `prisma migrate dev` wanted to RESET
  the DB because the pre-existing `avatar` column was in the DB but in no migration file. I
  did NOT reset. Maintainer chose the clean fix: baselined `avatar` via migration
  `20260701120000_baseline_avatar` marked `--applied` (recorded, not executed), then
  applied `20260701120100_add_user_access_token` via `prisma migrate deploy`.
  `prisma migrate status` = up to date; history now matches the live schema.
- Verification run: (1) DB check — `User` columns now include `accessToken`; the 1 existing
  User row survived (no data loss); existing row `accessToken` is NULL (expected until next
  login). (2) `./init.sh` baseline smoke check PASSES with the regenerated client
  (`/auth/` → 302, `/` → 200) — supporting only; it does not hit the callback success path.
- Status: `auth-003` is `passing`. Maintainer performed a manual Notion OAuth login and
  confirmed the access token is saved on the User (non-null `accessToken` persisted via the
  callback upsert) — the primary evidence.
- Commits: `auth-003` work committed and pushed after maintainer review (also tightened the
  AGENTS.md wording of the review-before-commit rule to cover all remaining features, since
  auth-003 now precedes sync-001).
- Files or artifacts updated: `prisma/schema.prisma`, two new `prisma/migrations/` folders,
  `server/api/auth.ts`, `feature_list.json`, `claude-progress.md`, `AGENTS.md`.
- Known risk or unresolved issue: token stored plaintext (MVP; encryption-at-rest out of
  scope, noted for future hardening). The pre-existing unnamed migration `20260617165202`
  remains in history but is not a blocker.
- Next best step: maintainer reviews the diff; perform one manual OAuth login to capture
  the non-null `accessToken` evidence and flip `auth-003` to `passing`; then start
  `sync-001`.

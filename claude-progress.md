# Progress Log

## Current Verified State

- Repository root: `/home/ajith/personal/Notion-Conflict-Dashboard`
- Standard startup path: `./init.sh`
- Standard verification path: behavioral smoke check inside `./init.sh` — boots the
  Express server (3001) and Next dev (3000), asserts `GET /auth/` → 302 to
  `api.notion.com/v1/oauth/authorize` and `GET /` → 200, then tears both down.
- Current highest-priority unfinished feature: `conflict-004` (`PATCH
  /conflicts/:id/resolve`). `auth-001`, `auth-002`, `dash-001`, `auth-003`,
  `sync-001`, `conflict-001`, `conflict-002`, `sync-002`, `sync-003`, `sync-004`, and
  `conflict-003` are `passing`.
- Current blocker: none. `conflict-003` implemented and verified (`GET /conflicts`
  returns only `status='unresolved'` rows as a raw JSON array, `200 []` when there are
  none); awaiting maintainer review before commit. `sync-004` (manual "Sync Now"
  button) is also still awaiting maintainer review from the prior session.

## Session Log

### Session 010

- Date: 2026-07-02
- Goal: Implement `conflict-003` — `GET /conflicts` returns unresolved conflicts.
- Planning: used plan mode. An Explore agent read `server/server.js`, `server/api/
  sync.ts` (the closest existing pattern, from `sync-004`), `server/api/auth.ts`,
  `server/lib/conflict.ts`, `prisma/schema.prisma`, and `server/PrismaClient.ts` to
  confirm there was no existing "list resource as JSON" GET route to reuse and that
  `Conflict` has no `workspaceId` field (no `Workspace` model exists at all — the
  feature's global, parameterless `curl` in its own verification is therefore the
  correct scope, not an oversight to fix). A Plan agent then designed the concrete
  approach; before finalizing, asked the maintainer two judgment-call questions via
  `AskUserQuestion` (both answered, "recommended" options chosen): (1) response shape —
  full raw Prisma rows vs. a trimmed DTO — maintainer chose full raw rows, since the
  verification wording reads as a minimum field set and `conflict-004` will need `id`
  to PATCH; (2) verification seed strategy — same real user on both sides of a
  directly-created `Conflict` row vs. conflict-001/002's synthetic-second-user pattern
  — maintainer chose the same-user approach, since identity distinctness isn't
  load-bearing when rows are seeded directly rather than via `detectConflicts()`'s
  presence-based grouping.
- Completed: Added `server/api/conflicts.ts` — a new Express router mirroring
  `sync.ts`'s structure (`express.Router()`, typed `Request`/`Response`, try/catch,
  `res.status(...).json(...)`) with `router.get('/', ...)` running
  `prisma.conflict.findMany({ where: { status: 'unresolved' }, orderBy: { createdAt:
  'desc' } })` and no `include` (the verification's named fields are all plain scalar
  columns already on `Conflict`). Deliberately has **no 404 branch**, unlike `sync.ts`
  — zero unresolved conflicts is a normal success state for a list endpoint, not a
  missing precondition, so it returns `200 []`. Mounted in `server/server.js` as
  `app.use('/conflicts', conflicts)` next to the existing `/auth` and `/sync` mounts.
  No `express.json()` needed (GET, no body), no CORS change needed (already global).
  No schema change, no new dependency, no frontend change (`app/Dashboard/page.tsx`
  keeps its own direct Prisma read from `conflict-002`; this endpoint is not wired to
  it — that would be scope creep for a future feature, if ever).
- Verification hiccup found and resolved mid-session (not a code bug, an environment
  one): a stale Express server process (PID 21606) was already listening on port 3001
  when verification began, started well before this session's file edits (confirmed
  via `stat` on the new/edited files vs. `ps -o lstart` on the stale PID) — almost
  certainly a leftover from an earlier session that `init.sh`'s documented `EXIT`-trap
  teardown gap left running. A first attempt to start a fresh server alongside it
  printed "Server is listing to 3001" but never actually bound the port (confirmed via
  `ss -ltnp`, which showed only the stale PID holding `LISTEN`) — so the first
  `curl /conflicts` 404'd against the *old* pre-change code, not the new route. Killed
  the stale process group and the non-binding duplicate, then started one clean
  instance; the new route worked immediately afterward. Consistent with `sync-004`'s
  session note that `server.js` runs under plain `tsx` with no watch mode and needs an
  explicit bounce to pick up route changes — worth remembering as a recurring class of
  false-negative in this repo's manual verification flow.
- Verification run: (1) DB baseline before seeding: 0 `Conflict` rows (prior features'
  synthetic rows were already cleaned up), 2 real `User` rows (id 1 and a newly-seen id
  12 — a second real user connected since the last session), real `Page` id=1 available.
  (2) Seeded via a throwaway, uncommitted script: `Conflict` id=6 (`status='unresolved'`,
  `resolvedBy=''`, `user1Id=1, user2Id=1`, `pageId=1`) and id=7 (`status='resolved'`,
  `resolvedBy='test-verification'`, `resolvedAt` set, same user/page pattern).
  (3) After resolving the stale-process issue: `curl -s http://localhost:3001/conflicts`
  → **HTTP 200**, body `[{"id":6,"pageId":1,"blockId":"conflict-003-test-block-
  unresolved","status":"unresolved","resolvedBy":"","user1Id":1,"user2Id":1,
  "createdAt":"2026-07-02T15:18:11.959Z","resolvedAt":null}]` — exactly the seeded
  unresolved row with all six required fields present, seeded resolved row (id=7)
  correctly excluded. Sanity-checked `GET /auth/` on the same process still → 302,
  confirming the new mount didn't disturb existing routing. (4) Cleanup: deleted both
  seeded `Conflict` rows via a throwaway script; DB confirmed count back to 0;
  immediately re-curled `GET /conflicts` → **HTTP 200**, body `[]` — confirms the
  zero-unresolved-conflicts case returns an empty array, not a 404 (the key deliberate
  deviation from `sync.ts`'s 404-on-missing-precondition pattern). (5) `npx tsc
  --noEmit` clean. (6) Manually-started dev server torn down; confirmed via `ss -ltnp`
  that ports 3000/3001 were free. (7) `./init.sh` baseline smoke check re-run:
  **PASSES** (`/auth/` → 302, `/` → 200, Postgres reachable); confirmed no stray
  listeners remained afterward — `init.sh`'s own teardown ran cleanly this time.
- Evidence captured: recorded in `feature_list.json` under `conflict-003.evidence`
  (includes the stale-process troubleshooting, so the record matches what actually
  happened).
- Commits: none yet (change staged for maintainer review per `AGENTS.md` working
  rules; `sync-004` from the prior session is also still pending review).
- Files or artifacts updated: `server/api/conflicts.ts` (new), `server/server.js`
  (2-line edit: import + mount), `feature_list.json`, `claude-progress.md`. Three
  throwaway scripts (`server/scripts/_checkConflicts.ts`,
  `_seedConflictsForVerification.ts`, `_cleanupConflictsVerification.ts`) were created
  and deleted during verification — none committed, none left behind.
- Known risk or unresolved issue: (1) confirms the pre-existing `init.sh` `EXIT`-trap
  teardown gap (flagged by `conflict-002`/`sync-003`) is still live and can leave a
  stale server process serving *old* code, which silently causes a false-negative
  curl result against a *different* process than the one just started — worth a fix
  in a future session, since it will keep costing verification time otherwise. (2)
  Carries forward `conflict-002`'s uncached-Prisma-read / `dynamic = "force-dynamic"`
  risk on `app/Dashboard/page.tsx` unchanged (not touched by this feature). (3) The
  response shape and scope decisions (raw rows, global/unscoped query) were confirmed
  with the maintainer via `AskUserQuestion` before implementation — see evidence — but
  are still worth a final look on diff review since they shape what `conflict-004`/
  `005` will build against.
- Next best step: maintainer reviews the `conflict-003` diff (and the still-pending
  `sync-004` diff); then start `conflict-004` — `PATCH /conflicts/:id/resolve` (next
  unfinished feature by priority; will need this endpoint's `id` field, confirmed
  present in the response shape chosen here).

### Session 009

- Date: 2026-07-02
- Goal: Implement `sync-004` — manual "Sync Now" button.
- Completed: Added `server/api/sync.ts`, a new Express router (mirrors `auth.ts`'s
  `express.Router()` pattern) with `router.post("/", ...)`: finds the connected user
  via the same inlined query already used by `syncScheduler.ts`/`runSync.ts`
  (`prisma.user.findFirst({ where: { accessToken: { not: null } } })` — no shared
  helper exists for this), returns 404 if none, otherwise calls
  `syncWorkspaceForUser(user)` (sync-001/sync-002's routine, unchanged) and responds
  200 with `{ workspaceId, pages, snapshots, syncedAt }`; any other failure responds
  500. Never logs the token. Mounted in `server/server.js` as `app.use("/sync", sync)`
  → `POST http://localhost:3001/sync`. Added
  `app/components/sync-now-button/SyncNowButton.tsx`, a `"use client"` component
  wired next to the "Connected pages" heading in `app/Dashboard/page.tsx`: the button
  POSTs to the backend, disables itself and shows "Syncing…" while in flight, shows
  inline red error text on failure, and calls `router.refresh()` on success to force
  the Dashboard server component to re-fetch fresh Prisma data. No schema change, no
  new dependency.
- Bug found and fixed during live browser verification (not caught by curl or
  typecheck): the first implementation called `router.refresh()` unawaited inside the
  `try` block and reset the loading state in `finally` — since `router.refresh()`
  doesn't return a promise, the button was re-enabling and reverting to "Sync Now"
  *before* the refreshed page data had actually painted, so a real click could show
  the button as "done" while the visible "Last synced" text was still a beat stale.
  Fixed using the documented Next.js pattern: wrapped `router.refresh()` in
  `useTransition()`'s `startTransition`, and gated the disabled/loading state on
  `isFetching || isPending` so it covers the re-render, not just the fetch. Re-ran the
  same live click test after the fix and confirmed the display now advances in step
  with the button re-enabling.
- Verification run: (1) `npx tsc --noEmit` clean (checked before and after the
  `useTransition` fix). (2) Backend curl: captured a DB baseline (8509 snapshots,
  latest `createdAt` 14:14:42Z), `curl -X POST http://localhost:3001/sync` → HTTP 200,
  body `{"workspaceId":"ddb7f940-ff25-8167-9c9f-000397b00f2f","pages":5,"snapshots":177,"syncedAt":...}`;
  re-queried the DB and confirmed the snapshot count and latest `createdAt` both
  advanced; grepped the server log for the access token — 0 matches. (3)
  No-connected-user path verified without touching real data: a throwaway script
  wrapped a query in `prisma.$transaction()`, nulled every `User.accessToken` inside
  the transaction, confirmed the route's `findFirst` predicate correctly returned
  `null`, then threw to force a rollback (never committed) — the real connected
  user's token was confirmed untouched afterward. (4) Real browser verification: no
  browser-automation tool was available in this environment (`chromium-cli` — the
  standard path per this repo's `/run` skill fallback — was not installed, nor was
  Playwright/Puppeteer); installed `puppeteer-core` into the session scratchpad only
  (not added to the project) and drove the system's already-installed
  `google-chrome-stable` headlessly, since curl cannot exercise client-side JS. Loaded
  `/Dashboard`, captured the 5 pages' displayed "Last synced" values, waited 90s with
  no interaction and confirmed the displayed values did **not** change (proves no
  client-side auto-refresh, and makes a post-click change unambiguous), clicked "Sync
  Now", confirmed it immediately showed `disabled:true`/"Syncing…", waited for
  completion, and confirmed all 5 pages' displayed timestamps had advanced to match
  fresh DB writes, with the button back to `disabled:false`/"Sync Now" and no error
  text. Zero browser console/page errors. Screenshots were visually reviewed (button
  renders correctly in both states) then deleted, not committed. (5) Error path:
  stopped the Express server, clicked "Sync Now" in the same harness — fetch rejected
  immediately ("Failed to fetch"), the button re-enabled (did not get stuck), and the
  inline red error text rendered exactly that message; confirmed via a reviewed
  screenshot; restarted the server afterward. (6) Process note: found both dev servers
  already running in the maintainer's own terminals (`npm start` / `npm run dev`) from
  outside this session; `server/server.js` runs via plain `tsx` with no watch mode, so
  it had to be bounced once to load the new route (Next's dev server was left running
  throughout — Fast Refresh picked up the frontend changes with no restart needed).
  (7) `./init.sh` baseline smoke check re-run after full teardown of all
  manually-managed dev processes: PASSES (`/auth/` → 302, `/` → 200); confirmed no
  stray listeners on 3000/3001 afterward.
- Evidence captured: full detail recorded in `feature_list.json`'s `sync-004.evidence`
  array (7 entries).
- Commits: none yet — per `AGENTS.md`, staged and awaiting maintainer review.
- Files or artifacts updated: `server/api/sync.ts` (new), `server/server.js` (2-line
  edit), `app/components/sync-now-button/SyncNowButton.tsx` (new),
  `app/Dashboard/page.tsx` (wiring edit), `feature_list.json`, `claude-progress.md`.
  Several throwaway scripts/driver files were created and deleted during verification
  (DB baseline checks, the transaction-rollback check, the two Puppeteer click
  drivers, screenshots) — none committed, none left behind.
- Known risk or unresolved issue: (carried forward) the pre-existing
  `dynamic = "force-dynamic"` static-rendering risk on `app/Dashboard/page.tsx`
  (flagged by `conflict-002`, carried by `sync-003`) is now more directly relevant,
  since `router.refresh()` depends on this route being dynamically rendered per
  request — confirmed fine under `next dev`, not fixed here since no build step is
  exercised by this repo's verification path yet. `SyncNowButton`'s hardcoded
  `http://localhost:3001` is a fourth hardcoded reference to that origin in the repo
  and will break outright under `deploy-002`'s Vercel/Render split — worth its own
  future feature. Concurrency between a manual sync and `sync-002`'s 60s poller is
  intentionally not coordinated (worst case: a few near-duplicate `Snapshot` rows, not
  corruption) — documented as an MVP limitation in `feature_list.json`'s notes. No
  fetch timeout/`AbortController` on the button — acceptable to defer given the
  measured ~15–20s typical sync duration. This repo still has no `chromium-cli` /
  Playwright / Puppeteer pre-installed for browser-driven verification — worth
  considering `/run-skill-generator` in a future session so this doesn't need
  reinstalling from scratch each time a UI interaction needs real click-testing.
- Next best step: `conflict-003` (`GET /conflicts` returns unresolved conflicts) —
  next-highest-priority `not_started` feature per `feature_list.json`.

### Session 008

- Date: 2026-07-02
- Goal: Implement `sync-003` — pages list with last-synced timestamp in the dashboard.
- Completed: Extended `app/Dashboard/page.tsx` (the only file with real edits — no
  schema change, no new file, no new dependency). Added a `prisma.page.findMany({
  orderBy: { createdAt: "desc" }, include: { snapshots: { orderBy: { createdAt:
  "desc" }, take: 1 } } })` query, fetched concurrently with the existing conflicts
  query via `Promise.all`. Added a second section below the conflicts list, headed
  "Connected pages", rendering one card per `Page` with its `tittle` and a "Last
  synced" line. Formatted the timestamp with a fixed `Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })` — no date library
  exists in the repo (confirmed via grep during planning: no date-fns/dayjs/luxon
  anywhere), and a fixed locale/timezone keeps the rendered string deterministic
  across environments rather than depending on server locale via bare
  `toLocaleString()`. Handled the zero-snapshot case (`page.snapshots[0]` can be
  `undefined`) by rendering "Never synced" — confirmed reachable by reading
  `server/lib/sync.ts`: the `Page` upsert commits before block-listing runs, so a
  page with zero child blocks, or one where `blocks.children.list` throws after the
  upsert (caught by the existing per-page try/catch), leaves a real `Page` row with
  no `Snapshot` rows. Not exercised via a live repro (no synthetic seed row created
  for it) — verified by code inspection only, consistent with using solely the real
  existing DB data for this feature's verification rather than seeding.
- Planning note: used plan mode for this feature (Explore agent confirmed no reusable
  date-formatting utility or "latest-related-record-per-parent" Prisma pattern exists
  anywhere in the repo — `conflict.ts`'s "latest per user per block" logic is
  hand-rolled in JS via `Map`, a different shape of problem; Plan agent then designed
  and validated the `include: { snapshots: { take: 1 } }` approach directly against
  the live DB before I implemented it).
- Verification run: (1) `npx tsc --noEmit` clean. (2) Captured DB ground truth before
  starting servers: 4 real `Page` rows (`Code Flow`, `Next js`, `Accenture`,
  `Conflict Dasboard Flow`), each with a real newest-`Snapshot.createdAt` in the
  `2026-07-02T10:56:0x` range — all four format to the same displayed string, `Jul 2,
  2026, 10:56 AM`, under the chosen formatter (minute-granularity display, expected
  since the four syncs landed in the same minute). (3) Booted both dev servers the
  same way `init.sh` does (`setsid`, Express 3001 + Next dev 3000); `curl -s
  http://localhost:3000/Dashboard` → **HTTP 200**, confirmed served by the run under
  test via the server's own access log (`GET /Dashboard 200`), not assumed (same
  discipline as `conflict-002`'s self-caught cwd bug). (4) Response-body checks used
  occurrence counting (`grep -o ... | wc -l`), not line counting (`grep -c`) — Next.js
  dev mode embeds both the rendered HTML and an RSC hydration payload in one response,
  so every string legitimately appears more than once; line-counting under-detects
  this. Confirmed: "Connected pages" heading present; "Last synced" present 8x (4
  pages × 2 — HTML + RSC payload); all 4 real page titles present; the expected
  formatted timestamp "Jul 2, 2026, 10:56 AM" present 8x, matching the DB ground truth
  captured in step 2 exactly (not a placeholder); "Never synced" present 0x (correct —
  all 4 real pages currently have snapshots). DB had 0 real `Conflict` rows at test
  time (both `conflict-001`/`conflict-002` sessions cleaned up their synthetic rows),
  so the conflicts section correctly rendered its pre-existing empty state, unaffected
  by this change. Precision caveat (advisor-caught, before recording rather than
  after): all 4 real pages' newest-Snapshot timestamps collapsed to the same displayed
  minute, so the HTML grep alone can't distinguish "each card shows its own page's
  correct time" from "every card coincidentally shows an identical string" — per-page
  correctness rests on the rendered query being byte-identical to the one already
  validated against the ground-truth script (which does return distinct correct
  per-page values), not on the grep in isolation. (5) Background note: `sync-002`'s
  scheduler is wired into `server.js` boot, so `npm start` during this verification
  also started the real 60s poller; one real tick fired during the test window (DB
  `Snapshot` count went 697 → 783, +86 — a full real sync, not caused by or related to
  this feature's code). Because that poller runs on every server boot, the dashboard's
  "last synced" time advances roughly every 60s the server is up — a maintainer
  opening `/Dashboard` later should expect a later timestamp than "Jul 2, 2026, 10:56
  AM" recorded here, not treat that as a discrepancy.
  (6) Tore down both servers, confirmed no stray listeners on 3000/3001, then
  re-ran the full `./init.sh` baseline: PASSES (`/auth/` → 302, `/` → 200).
- Evidence captured: recorded in `feature_list.json` under `sync-003.evidence`.
- Commits: none yet (change staged for maintainer review per `AGENTS.md` working
  rules).
- Files or artifacts updated: `app/Dashboard/page.tsx` (modified), `feature_list.json`,
  `claude-progress.md`. Two throwaway one-off inspection scripts
  (`server/scripts/groundTruthPages.ts`, `server/scripts/checkCounts.ts`) were created
  during verification (same pattern as prior sessions) and deleted afterward — nothing
  test-only left in the repo. No DB rows were seeded or need cleanup — this feature's
  verification ran entirely against real existing data.
- Known risk or unresolved issue: carries forward `conflict-002`'s two open risks
  unchanged — the Dashboard's uncached Prisma read (now doing two concurrent queries
  instead of one) still has no dynamic-rendering marker (flag before `deploy-002`'s
  `next build`), and `init.sh`'s `EXIT` trap still doesn't always fully tear down its
  process tree (worked around by hand again this session — one `node` process stayed
  bound to 3001 after the first manual `kill -TERM -- -$pid` and needed a direct `kill
  -TERM <pid>`). NEW, unfixed on purpose: the zero-snapshot ("Never synced") branch is
  verified by inspection only, not exercised live — flag if a future session wants
  stronger evidence for it (e.g. `sync-004`, when a real sync attempt could plausibly
  produce a page with zero blocks).
- Next best step: maintainer reviews the `sync-003` diff; then start `sync-004` — a
  manual "Sync Now" button on the dashboard that triggers `syncWorkspaceForUser()` via
  a new `POST /sync` endpoint and updates the pages list/last-synced time in the UI
  (next unfinished feature by priority; builds directly on this session's pages list).

### Session 007

- Date: 2026-07-02
- Goal: Implement `sync-002` — 60-second polling snapshot engine.
- Completed: Added `server/lib/syncScheduler.ts` exporting `startSyncPolling(intervalMs
  = 60_000)` / `stopSyncPolling()`, reusing `syncWorkspaceForUser()` (`sync-001`)
  unchanged. Selects the same "first user with a non-null `accessToken`" as
  `runSync.ts` (`prisma.user.findFirst`), not all connected users — deliberate:
  `conflict-001`'s detection is presence-based (2+ distinct syncing users on a block =
  `Conflict`), so auto-syncing every connected user every 60s would flood false
  conflicts the moment a second real user connects. The interval handle and an
  `isRunning` flag are cached on `globalThis` (same pattern as `app/lib/prisma.ts`) so
  a repeat `startSyncPolling()` call in the same process reuses the existing timer
  instead of stacking a new one, and an in-flight tick makes the next tick log-and-skip
  instead of running concurrently. Wired into `server/server.js`: `startSyncPolling()`
  is called once inside `app.listen()`'s callback; `stopSyncPolling()` added to the
  existing `SIGINT`/`SIGTERM` handlers next to `server.close()`. Token never logged.
- Verification run: (1) `./init.sh` baseline first: PASSES. (2) Confirmed the stored
  connected user's Notion `accessToken` still works and measured real sync duration
  before designing the timing test — ran the existing `npm run sync`
  (DB: 129 → 215 snapshots, 4 pages, +86 snapshots) and timed a second manual run at
  ~21s (mostly Notion API latency across 4 pages' block-listing calls). (3) Exercised
  the scheduler live with a short interval via a throwaway script (not committed):
  called `startSyncPolling(5000)` twice back-to-back — logged "Sync polling started:
  every 5000ms." exactly once, and the second call returned the identical handle
  ("Same handle returned: true"), confirming within-process idempotency. (4) Let that
  5s-interval scheduler run ~50s against the real connected workspace: the live log
  showed several "Sync poll complete: ... 4 page(s), 86 snapshot(s)" completions
  interleaved with "Sync poll skipped: previous run still in progress." lines — the
  overlap guard fired for real, since each real sync (~21s) comfortably outlasts a 5s
  tick. The visible-log completion count turned out to be an undercount (see the
  reconciliation below) — the property being tested (ticks fire, overlaps get
  skipped, completions write real rows) held regardless. (4b) Reconciled precisely
  from the DB instead of trusting the terminal capture: total Snapshot rows went from
  215 (after the token-check run) to 697 (net +482). Rather than back-compute a run
  count from that delta (per-run size varies when a page is skipped, so the naive
  arithmetic — 215 + 86 + 4×86 = 645 — doesn't reconcile with 697), queried one
  specific `blockId`'s own row history directly, which is unambiguous since each run
  writes at most one row per block: 9 total rows — 2 pre-session (2026-07-01 and an
  earlier 2026-07-02 run) plus exactly 7 new this session, timestamped 10:53:49 and
  10:54:38 (the two manual runs) and five more between 10:55:22 and 10:56:01 (five
  real, non-skipped scheduler ticks) — one more real completion than the live log
  appeared to show. Distinctness check: 86 distinct `blockId`s total (matches the real
  workspace's block count) — confirms genuine append-only time-series growth for the
  same blocks across every run, not new/different blocks appearing.
  (5) Confirmed the production default without a live ~130s wait: started the real
  server (`npm start --prefix server`) and grepped its boot log for "Sync polling
  started: every 60000ms." — present; the tick logic itself was already proven live at
  a shorter interval on the same code path, so this stands in for waiting two full
  default-length intervals. (6) `./init.sh` baseline re-run after all verification:
  PASSES. `npx tsc --noEmit` (root) clean — `server/` has no separate tsconfig/typecheck
  step in this repo's verification path, same as the existing `server/lib/conflict.ts`
  and `server/lib/sync.ts`. No leftover dev processes or listeners on 3000/3001; all
  throwaway test scripts deleted.
- Self-caught evidence-precision bug (same class as `conflict-002`'s cwd bug, caught
  the same way — before recording it, not after): the first draft of this evidence
  claimed "215 → 697 after the calibration run + the 4 scheduler completions," which
  is arithmetically impossible (215 + 86 + 4×86 = 645 ≠ 697) and undercounts what the
  DB actually shows (5 real scheduler completions for the sampled block, not 4).
  Corrected by reconciling directly from one block's own row history instead of
  trusting the terminal-captured log line count — see the verification run's
  item (4b) above. Lesson for later sessions: when a delta doesn't reconcile, requery
  the DB for ground truth rather than adjust the narrative to fit the log capture.
- Data handling note (different from the last two sessions on purpose): the ~482 new
  `Snapshot` rows created during this verification are real product data against the
  real connected workspace, not synthetic seed rows — left in the DB rather than
  cleaned up, unlike `conflict-001`/`conflict-002`'s synthetic test rows (which *were*
  deleted because they'd otherwise pollute `team-001`/`dash-002`/`dash-004` later).
- Scope note: `detectConflicts()` is deliberately **not** called from this interval —
  `conflict-001`'s notes merely invite that integration for a future feature;
  wiring it in now would violate `single_active_feature`.
- Evidence captured: recorded in `feature_list.json` under `sync-002.evidence`.
- Commits: none yet (change staged for maintainer review per `AGENTS.md` working
  rules).
- Files or artifacts updated: `server/lib/syncScheduler.ts` (new), `server/server.js`
  (modified), `feature_list.json`, `claude-progress.md`. All throwaway
  inspection/calibration/test scripts used during verification were deleted after use;
  the real Snapshot rows they caused to be written were intentionally kept (see data
  handling note above).
- Known risk or unresolved issue: (1) first-user-only polling is a documented design
  decision, not an oversight — flagged for review, and worth revisiting once
  `team-001` makes multi-user workspaces real (`conflict-001`'s presence-based
  detection has no time window, so naively syncing every connected user on every tick
  would flood false conflicts today). (2) carries forward `conflict-002`'s two open
  risks unchanged: the Dashboard's uncached Prisma read has no dynamic-rendering
  marker (flag before `deploy-002`'s `next build`), and `init.sh`'s `EXIT` trap doesn't
  always fully tear down its process tree (work around it by hand for now).
- Next best step: maintainer reviews the `sync-002` diff; then start `sync-003` —
  pages list with last-synced timestamp in the dashboard (next unfinished feature by
  priority; derives "last synced" from the newest related `Snapshot.createdAt` per
  page, which this feature's real accumulated snapshots already make possible to
  demo).

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

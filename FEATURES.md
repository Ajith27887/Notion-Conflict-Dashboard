# App Features

One line per feature, generated from `feature_list.json` (24 features, 13 passing / 11 not started).
Legend: ✅ passing · 🚧 in progress · 🔴 blocked · ⬜ not started

## Auth
- ✅ `auth-001` — Clicking 'Continue with Notion' sends the user to Notion's authorize screen.
- ✅ `auth-002` — After authorizing on Notion, the user is returned, their profile is stored, and they land on /Dashboard.
- ✅ `auth-003` — After a user authorizes on Notion, their access token is saved so the app can later read their workspace on their behalf.

## Dashboard
- ✅ `dash-001` — An authenticated user sees the dashboard shell at /Dashboard instead of a 404.
- ⬜ `dash-002` — The dashboard header shows summary cards for total conflicts, resolved, unresolved, and the most active page.
- ⬜ `dash-003` — The dashboard shows a bar chart of conflicts over time.
- ⬜ `dash-004` — The dashboard shows which pages have the most conflicts and which users cause the most conflicts.

## Sync
- ✅ `sync-001` — After connecting, the user's Notion pages and block snapshots are stored for the workspace.
- ✅ `sync-002` — Once a workspace is connected, its pages and block snapshots refresh automatically about every 60 seconds without any manual action.
- ✅ `sync-003` — The dashboard lists every connected Notion page and shows when each was last synced.
- ✅ `sync-004` — A 'Sync Now' button on the dashboard triggers an immediate sync and the pages list/last-synced time updates.

## Conflict
- ✅ `conflict-001` — When two users edit the same block around the same time, a conflict is recorded.
- ✅ `conflict-002` — The dashboard shows detected conflicts with their status and who resolved them.
- ✅ `conflict-003` — The app can list all currently unresolved conflicts for a workspace.
- ✅ `conflict-004` — Resolving a conflict marks it resolved, records who resolved it and when, and removes it from the unresolved list.
- ✅ `conflict-005` — Each conflict shows User1's version next to User2's version with 'Keep User1' and 'Keep User2' buttons; resolving removes it from the list.
- ⬜ `conflict-006` — When a user clicks 'Keep User1' or 'Keep User2' on a conflict, the chosen version is written back to the actual Notion block, not just recorded in Concord's own dashboard.

## Team
- ⬜ `team-001` — The app can list all users connected to the same workspace as one team.
- ⬜ `team-002` — When a new conflict is detected, the involved team members receive an email notification.
- ⬜ `team-003` — A team page shows each member's avatar, name, and how many conflicts they are involved in.
- ⬜ `team-004` — The user can filter the conflicts list by team member and sees a badge on the dashboard when a new conflict arrives.

## Polish
- ⬜ `polish-001` — The app handles errors gracefully, shows loading indicators while fetching, shows friendly empty states, and is usable on mobile.

## Deploy
- ⬜ `deploy-001` — A seed script populates realistic demo users, pages, snapshots, and conflicts so the dashboard looks populated for a demo.
- ⬜ `deploy-002` — The app is reachable at a public URL: frontend on Vercel, backend on Render, database on Supabase.

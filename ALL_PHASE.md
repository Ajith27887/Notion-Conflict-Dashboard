### **Phase 1 — Database (2 days)**

**Tables you need:**

prisma

`model User {
  id              Int         @id @default(autoincrement())
  notionId        String      @unique
  name            String
  email           String      @unique
  accessToken     String
  workspaceId     String
  createdAt       DateTime    @default(now())
  snapshots       Snapshot[]
  conflicts       Conflict[]
}

model Page {
  id          Int         @id @default(autoincrement())
  notionPageId String     @unique
  title       String
  workspaceId String
  snapshots   Snapshot[]
  conflicts   Conflict[]
  createdAt   DateTime    @default(now())
}

model Snapshot {
  id          Int      @id @default(autoincrement())
  pageId      Int
  userId      Int
  blockId     String
  content     String
  page        Page     @relation(fields: [pageId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
}

model Conflict {
  id            Int      @id @default(autoincrement())
  pageId        Int
  blockId       String
  user1Id       Int
  user2Id       Int
  user1Content  String
  user2Content  String
  status        String   // "unresolved" | "resolved"
  resolvedBy    Int?
  page          Page     @relation(fields: [pageId], references: [id])
  user1         User     @relation("ConflictUser1", fields: [user1Id], references: [id])
  user2         User     @relation("ConflictUser2", fields: [user2Id], references: [id])
  createdAt     DateTime @default(now())
  resolvedAt    DateTime?
}`

**Done when:** All tables visible in Supabase.

---

### **Phase 2 — Notion OAuth (2 days)**

**BE:**

- `GET /auth/notion` → redirect to Notion OAuth
- `GET /auth/callback` → exchange code for access token
- Save user + `workspaceId` + `accessToken` to DB
- JWT session after login

**FE:**

- Login page — "Connect Notion Workspace" button
- After login → redirect to dashboard

**Done when:** Click connect → Notion login → user saved to DB → lands on dashboard.

---

### **Phase 3 — Page Sync + Snapshot Engine (3 days)**

**BE:**

- `GET /pages` → fetch all pages from user's Notion workspace using access token
- Save pages to Page table
- Snapshot logic:
    - Fetch each page's blocks from Notion API
    - For each block — save a Snapshot row with `blockId`, `content`, `userId`, `pageId`
    - Run this every 60 seconds using `setInterval` — this is your polling engine

**FE:**

- Pages list in dashboard — all connected Notion pages
- Last synced timestamp per page
- Manual "Sync Now" button

**Done when:** Your DB has real snapshots of your Notion pages updating every 60 seconds.

---

### **Phase 4 — Conflict Detection Engine (3 days)**

**BE:**

- After every new snapshot — run conflict detection:

`For each block in the new snapshot
        ↓
Find the previous snapshot of same block
        ↓
If content is different AND edited by different user
        ↓
Create a Conflict row`

- `GET /conflicts` → return all unresolved conflicts
- `PATCH /conflicts/:id/resolve` → mark conflict as resolved, save `resolvedBy` and `resolvedAt`

**FE:**

- Conflicts list — page title, block content, which users conflicted, when
- Side by side view — User1 version vs User2 version
- Resolve buttons — "Keep User1" "Keep User2"
- After resolving → conflict disappears from list

**Done when:** Edit a Notion page as two different users → conflict appears in dashboard → resolve it → it disappears.

---

### **Phase 5 — Dashboard UI (2 days)**

**FE:**

- Stat cards:

`Total Conflicts    Resolved    Unresolved    Most Active Page`

- Conflicts over time chart — Recharts bar chart
- Recent conflicts live table
- Page health view — which pages have most conflicts
- Team activity — which users cause most conflicts

**Done when:** Dashboard shows real data from your actual conflicts.

---

### **Phase 6 — Team Features (2 days)**

**BE:**

- Workspace concept — all users with same `workspaceId` are in the same team
- `GET /team` → list all team members connected to the workspace
- Conflict shows which two team members clashed
- Email notification when new conflict detected — use `nodemailer`

**FE:**

- Team members page — avatars, name, conflict count
- Filter conflicts by team member
- Notification badge on dashboard when new conflict arrives

**Done when:** Two team members connected to same workspace — one edits a page, other edits same block — both see the conflict in their dashboard.

---

### **Phase 7 — Polish + Deploy (1 day)**

- Error handling everywhere
- Loading states
- Empty states — "No conflicts detected 🎉"
- Mobile responsive
- Deploy — Supabase + Render + Vercel
- Seed demo data for resume showcase
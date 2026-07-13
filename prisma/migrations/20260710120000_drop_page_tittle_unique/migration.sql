-- Multi-tenant fix (public app conversion): a page title is only unique within a
-- workspace, not globally. The global unique index made the second workspace's
-- same-titled page (e.g. two "Untitled" pages) fail to sync — the upsert threw a
-- unique violation that snapshotPage's per-page try/catch swallowed, silently
-- dropping the page. notionPageId remains the stable identity/@unique.
-- DropIndex
DROP INDEX "Page_tittle_key";

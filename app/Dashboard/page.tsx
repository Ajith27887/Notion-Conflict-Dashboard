import prisma from "../lib/prisma";
import SyncNowButton from "../components/sync-now-button/SyncNowButton";
import ResolveConflictButtons from "../components/resolve-conflict-buttons/ResolveConflictButtons";
import StatCards from "../components/stat-cards/StatCards";
import ConflictLiveUpdates from "../components/conflict-live-updates/ConflictLiveUpdates";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function Dashboard() {
  const [conflicts, pages, statusCounts, topPageGroup] = await Promise.all([
    prisma.conflict.findMany({
      where: { status: "unresolved" },
      orderBy: { createdAt: "desc" },
      include: { page: true, user1: true, user2: true },
    }),
    prisma.page.findMany({
      orderBy: { createdAt: "desc" },
      include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.conflict.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.conflict.groupBy({
      by: ["pageId"],
      _count: { _all: true },
      orderBy: [{ _count: { pageId: "desc" } }, { pageId: "asc" }],
      take: 1,
    }),
  ]);

  const total = statusCounts.reduce((sum, group) => sum + group._count._all, 0);
  const resolved =
    statusCounts.find((group) => group.status === "resolved")?._count._all ?? 0;
  const unresolved =
    statusCounts.find((group) => group.status === "unresolved")?._count._all ?? 0;
  const topPage = topPageGroup[0];
  const mostActivePage = topPage
    ? {
        tittle: pages.find((page) => page.id === topPage.pageId)?.tittle ?? "—",
        count: topPage._count._all,
      }
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-zinc-500">
          Edit conflicts detected across your Notion workspace.
        </p>
      </header>
      <main className="px-8 py-10">
        <ConflictLiveUpdates />
        <StatCards
          total={total}
          resolved={resolved}
          unresolved={unresolved}
          mostActivePage={mostActivePage}
        />
        {conflicts.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
            No conflicts to show yet.
          </section>
        ) : (
          <ul className="flex flex-col gap-4">
            {conflicts.map((conflict) => (
              <li
                key={conflict.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-900">
                    {conflict.page?.tittle ?? conflict.blockId}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      conflict.status === "resolved"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {conflict.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {conflict.user1?.name ?? conflict.user1?.email} and{" "}
                  {conflict.user2?.name ?? conflict.user2?.email} both edited
                  block {conflict.blockId}.
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Resolved by:{" "}
                  <span className="font-medium text-zinc-700">
                    {conflict.resolvedBy || "—"}
                  </span>
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {conflict.user1?.name ?? conflict.user1?.email}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                      {conflict.user1Content || "No content captured."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {conflict.user2?.name ?? conflict.user2?.email}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                      {conflict.user2Content || "No content captured."}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ResolveConflictButtons
                    conflictId={conflict.id}
                    user1Label={
                      conflict.user1?.name ?? conflict.user1?.email ?? "User 1"
                    }
                    user2Label={
                      conflict.user2?.name ?? conflict.user2?.email ?? "User 2"
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Connected pages
          </h2>
          <SyncNowButton />
        </div>
        {pages.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
            No pages synced yet.
          </section>
        ) : (
          <ul className="flex flex-col gap-4">
            {pages.map((page) => (
              <li
                key={page.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <h3 className="font-semibold text-zinc-900">{page.tittle}</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Last synced:{" "}
                  <span className="font-medium text-zinc-700">
                    {page.snapshots[0]
                      ? lastSyncedFormatter.format(page.snapshots[0].createdAt)
                      : "Never synced"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

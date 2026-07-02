import prisma from "../lib/prisma";

export default async function Dashboard() {
  const conflicts = await prisma.conflict.findMany({
    orderBy: { createdAt: "desc" },
    include: { page: true, user1: true, user2: true },
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-zinc-500">
          Edit conflicts detected across your Notion workspace.
        </p>
      </header>
      <main className="px-8 py-10">
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
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

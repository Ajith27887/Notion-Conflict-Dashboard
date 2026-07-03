type StatCardsProps = {
  total: number;
  resolved: number;
  unresolved: number;
  mostActivePage: { tittle: string; count: number } | null;
};

function StatCard({
  label,
  value,
  valueClassName = "text-zinc-900",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function StatCards({
  total,
  resolved,
  unresolved,
  mostActivePage,
}: StatCardsProps) {
  return (
    <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Conflicts" value={total} />
      <StatCard label="Resolved" value={resolved} valueClassName="text-green-700" />
      <StatCard label="Unresolved" value={unresolved} valueClassName="text-amber-700" />
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Most Active Page
        </p>
        <p className="mt-2 truncate text-3xl font-bold text-zinc-900">
          {mostActivePage ? mostActivePage.tittle : "—"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {mostActivePage
            ? `${mostActivePage.count} conflict${mostActivePage.count === 1 ? "" : "s"}`
            : "0 conflicts"}
        </p>
      </div>
    </div>
  );
}

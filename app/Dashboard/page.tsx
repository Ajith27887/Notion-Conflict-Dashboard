export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-zinc-500">
          Edit conflicts detected across your Notion workspace.
        </p>
      </header>
      <main className="px-8 py-10">
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No conflicts to show yet.
        </section>
      </main>
    </div>
  );
}

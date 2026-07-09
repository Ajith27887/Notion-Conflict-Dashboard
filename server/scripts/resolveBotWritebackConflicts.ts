import prisma from "../PrismaClient.js";

// One-off cleanup for bug-001. Before the identity-based anti-loop guard landed,
// a "Keep User1" resolve could spawn a spurious NEW unresolved Conflict row for
// the same block — the conflict-006 write-back landing, mis-detected as a human
// edit. Those stuck rows keep showing on the dashboard forever (detection never
// re-evaluates a row it already recorded).
//
// This marks such rows resolved (non-destructive — history is kept), identifying
// them the same way detection now suppresses them: the row's source snapshot
// (Conflict.sourceSnapshotId) was authored by the integration's own bot
// (Snapshot.notionLastEditedBy ∈ the persisted User.botId set). Safe to re-run;
// it only touches rows still status="unresolved".
//
// Run from server/:  npm run cleanup-bot-conflicts
async function main() {
	const users = await prisma.user.findMany({ select: { botId: true } });
	const botIds = new Set(
		users.map((user) => user.botId).filter((id): id is string => id !== null),
	);
	if (botIds.size === 0) {
		console.log("No User.botId values found — nothing to match. Run OAuth first so bot ids are persisted.");
		return;
	}

	const unresolved = await prisma.conflict.findMany({
		where: { status: "unresolved", sourceSnapshotId: { not: null } },
		select: { id: true, blockId: true, sourceSnapshotId: true },
	});
	if (unresolved.length === 0) {
		console.log("No unresolved conflicts with a source snapshot. Nothing to clean up.");
		return;
	}

	const sourceIds = unresolved
		.map((conflict) => conflict.sourceSnapshotId)
		.filter((id): id is number => id !== null);
	const sourceSnapshots = await prisma.snapshot.findMany({
		where: { id: { in: sourceIds } },
		select: { id: true, notionLastEditedBy: true },
	});
	const editorBySnapshotId = new Map(sourceSnapshots.map((s) => [s.id, s.notionLastEditedBy]));

	const stuck = unresolved.filter((conflict) => {
		const editor = conflict.sourceSnapshotId !== null ? editorBySnapshotId.get(conflict.sourceSnapshotId) : null;
		return editor !== null && editor !== undefined && botIds.has(editor);
	});

	if (stuck.length === 0) {
		console.log("No bot-authored (write-back landing) unresolved conflicts found. Nothing to clean up.");
		return;
	}

	console.log(
		`Found ${stuck.length} spurious write-back-landing conflict(s): ` +
			stuck.map((c) => `#${c.id}(block ${c.blockId})`).join(", "),
	);

	const result = await prisma.conflict.updateMany({
		where: { id: { in: stuck.map((c) => c.id) }, status: "unresolved" },
		data: { status: "resolved", resolvedBy: "system:bug-001", resolvedAt: new Date() },
	});
	console.log(`Marked ${result.count} conflict(s) resolved (resolvedBy="system:bug-001").`);
}

main()
	.catch((error) => {
		console.error("Cleanup failed:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

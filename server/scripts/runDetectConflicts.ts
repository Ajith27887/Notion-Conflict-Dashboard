import prisma from "../PrismaClient.js";
import { detectConflicts } from "../lib/conflict.js";

// Thin on-demand trigger for conflict-001 verification. A future sync-002 interval
// or HTTP endpoint can call detectConflicts() directly after each sync run instead
// of shelling out to this script.
//
// Run from server/:  npm run detect-conflicts
async function main() {
	// Public app: detection is per-workspace. Run it for every connected workspace,
	// passing that workspace's token so unmapped editors can be named via Notion
	// (team-006 Option B).
	const users = await prisma.user.findMany({
		where: { accessToken: { not: null } },
		distinct: ["workspaceId"],
	});
	if (users.length === 0) {
		console.log("Conflict detection: no connected workspace yet.");
		return;
	}
	let total = 0;
	for (const user of users) {
		const summary = await detectConflicts(user.workspaceId, {
			accessToken: user.accessToken!,
			workspaceId: user.workspaceId,
		});
		total += summary.conflictsCreated;
		console.log(`  workspace ${user.workspaceId}: ${summary.conflictsCreated} conflict(s) created.`);
	}
	console.log(`Conflict detection complete: ${total} conflict(s) created across ${users.length} workspace(s).`);
}

main()
	.catch((error) => {
		console.error("Conflict detection failed:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

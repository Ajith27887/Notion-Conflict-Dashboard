import prisma from "../PrismaClient.js";
import { detectConflicts } from "../lib/conflict.js";

// Thin on-demand trigger for conflict-001 verification. A future sync-002 interval
// or HTTP endpoint can call detectConflicts() directly after each sync run instead
// of shelling out to this script.
//
// Run from server/:  npm run detect-conflicts
async function main() {
	const summary = await detectConflicts();
	console.log(`Conflict detection complete: ${summary.conflictsCreated} conflict(s) created.`);
}

main()
	.catch((error) => {
		console.error("Conflict detection failed:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

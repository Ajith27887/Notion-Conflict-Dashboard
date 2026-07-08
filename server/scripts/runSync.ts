import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "../lib/sync.js";

// Thin on-demand trigger for sync-001 verification. The real HTTP endpoint is
// sync-004 (POST /sync) and the 60s interval is sync-002 — both reuse the same
// syncWorkspaceForUser routine this script calls.
//
// Run from server/:  npm run sync
async function main() {
	const user = await prisma.user.findFirst({
		where: { accessToken: { not: null } },
	});

	if (!user) {
		const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
		console.error(
			"No connected user with a Notion access token found. " +
				`Log in via the Notion OAuth flow first (${apiBaseUrl}/auth/), then re-run.`,
		);
		process.exit(1);
	}

	console.log(`Syncing workspace ${user.workspaceId} as user ${user.id}...`);
	const summary = await syncWorkspaceForUser(user);
	console.log(
		`Sync complete: ${summary.pages} page(s) upserted, ${summary.snapshots} snapshot(s) created.`,
	);
}

main()
	.catch((error) => {
		console.error("Sync failed:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

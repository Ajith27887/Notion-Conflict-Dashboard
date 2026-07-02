import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "./sync.js";

const DEFAULT_INTERVAL_MS = 60_000;

// Cached on globalThis (mirrors app/lib/prisma.ts) so a second startSyncPolling()
// call in the same process reuses the existing timer instead of stacking a new one.
const schedulerState = globalThis as unknown as {
	syncSchedulerHandle?: ReturnType<typeof setInterval>;
	syncSchedulerRunning?: boolean;
};

async function pollOnce(): Promise<void> {
	if (schedulerState.syncSchedulerRunning) {
		console.log("Sync poll skipped: previous run still in progress.");
		return;
	}
	schedulerState.syncSchedulerRunning = true;
	try {
		const user = await prisma.user.findFirst({ where: { accessToken: { not: null } } });
		if (!user) {
			console.log("Sync poll: no connected user with a Notion access token yet.");
			return;
		}
		const summary = await syncWorkspaceForUser(user);
		console.log(
			`Sync poll complete: workspace ${user.workspaceId} (user ${user.id}) -> ` +
				`${summary.pages} page(s), ${summary.snapshots} snapshot(s).`,
		);
	} catch (error) {
		console.error("Sync poll failed:", error instanceof Error ? error.message : String(error));
	} finally {
		schedulerState.syncSchedulerRunning = false;
	}
}

export function startSyncPolling(intervalMs: number = DEFAULT_INTERVAL_MS) {
	if (schedulerState.syncSchedulerHandle) {
		return schedulerState.syncSchedulerHandle;
	}
	const handle = setInterval(() => {
		void pollOnce();
	}, intervalMs);
	schedulerState.syncSchedulerHandle = handle;
	console.log(`Sync polling started: every ${intervalMs}ms.`);
	return handle;
}

export function stopSyncPolling(): void {
	if (schedulerState.syncSchedulerHandle) {
		clearInterval(schedulerState.syncSchedulerHandle);
		schedulerState.syncSchedulerHandle = undefined;
	}
}

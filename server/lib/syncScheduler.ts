import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "./sync.js";
import { detectConflicts } from "./conflict.js";
import { emitConflictsCreated } from "./conflictEvents.js";

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
		// Public app: the poll is the fallback reconciliation sweep across ALL
		// connected workspaces (the webhook is the primary, per-workspace path). One
		// representative connected user per workspace drives that workspace's
		// sync + scoped detection. NOTE: polling every workspace every tick is a known
		// scaling smell — webhook-primary keeps it cheap for now; revisit (staggering /
		// per-workspace cadence) if the number of workspaces grows.
		const users = await prisma.user.findMany({
			where: { accessToken: { not: null } },
			distinct: ["workspaceId"],
		});
		if (users.length === 0) {
			console.log("Sync poll: no connected user with a Notion access token yet.");
			return;
		}

		for (const user of users) {
			try {
				const summary = await syncWorkspaceForUser(user);
				console.log(
					`Sync poll: workspace ${user.workspaceId} (user ${user.id}) -> ` +
						`${summary.pages} page(s), ${summary.snapshots} snapshot(s).`,
				);

				// Change-based detection, scoped to this workspace. Safe to run every
				// tick: sourceSnapshotId dedup + the bot-writeback anti-loop mean
				// unchanged blocks and already-recorded/resolved changes create nothing.
				// Emit (scoped) on real creations so the tenant's live dashboard
				// (dash-005 SSE) updates without a refresh, mirroring the webhook path.
				const detection = await detectConflicts(
					user.workspaceId,
					user.accessToken ? { accessToken: user.accessToken, workspaceId: user.workspaceId } : undefined,
				);
				if (detection.conflictsCreated > 0) {
					console.log(`Sync poll: workspace ${user.workspaceId} -> ${detection.conflictsCreated} conflict(s) created.`);
					emitConflictsCreated({ workspaceId: user.workspaceId, pageId: null, count: detection.conflictsCreated });
				}
			} catch (error) {
				// One workspace's failure must not abort the rest of the sweep.
				console.error(
					`Sync poll failed for workspace ${user.workspaceId}:`,
					error instanceof Error ? error.message : String(error),
				);
			}
		}
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

import type { Snapshot } from "../../app/generated/prisma/index.js";
import prisma from "../PrismaClient.js";

export type ConflictSummary = {
	conflictsCreated: number;
};

// Detect blocks that have been synced by 2+ distinct users and record a Conflict
// row for each newly-found pair. This is presence-based, not content-based:
// Snapshot.userId records who *synced* the block, not who *edited* it in Notion
// (no last_edited_by/last_edited_time is captured), so "conflict" here means "this
// block has contributions from multiple connected users," which is the strongest
// signal the current schema can give. sync-002/sync-004 can call this same routine
// after every sync run, the same way they reuse sync-001's syncWorkspaceForUser.
//
// MVP limitations: no time-window (any two distinct contributors ever seen on a
// block count, regardless of how far apart in time); with 3+ contributors on one
// block, only the earliest pair is flagged (Conflict is a two-party model).
export async function detectConflicts(): Promise<ConflictSummary> {
	const snapshots = await prisma.snapshot.findMany({
		orderBy: { createdAt: "asc" },
	});

	const latestByBlock = new Map<string, Map<number, Snapshot>>();
	for (const snapshot of snapshots) {
		if (!latestByBlock.has(snapshot.blockId)) {
			latestByBlock.set(snapshot.blockId, new Map());
		}
		// Ascending order means a later snapshot for the same user overwrites the
		// earlier one, leaving each user's latest touch on this block.
		latestByBlock.get(snapshot.blockId)!.set(snapshot.userId, snapshot);
	}

	let conflictsCreated = 0;

	for (const [blockId, byUser] of latestByBlock) {
		if (byUser.size < 2) {
			continue;
		}

		const contributors = [...byUser.values()].sort(
			(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
		);
		const [user1, user2] = contributors;

		const existing = await prisma.conflict.findFirst({
			where: {
				blockId,
				OR: [
					{ user1Id: user1.userId, user2Id: user2.userId },
					{ user1Id: user2.userId, user2Id: user1.userId },
				],
			},
		});
		if (existing) {
			continue;
		}

		await prisma.conflict.create({
			data: {
				pageId: user1.pageId,
				blockId,
				user1Id: user1.userId,
				user2Id: user2.userId,
				status: "unresolved",
				resolvedBy: "",
			},
		});
		conflictsCreated += 1;
	}

	return { conflictsCreated };
}

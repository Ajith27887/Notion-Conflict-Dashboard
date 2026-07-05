import { Client } from "@notionhq/client";
import prisma from "../PrismaClient.js";

export type ConflictSummary = {
	conflictsCreated: number;
};

// Context of the connected user whose token drives this detection run. Optional:
// when absent (e.g. a tokenless script call), attribution degrades gracefully to
// the syncing user and no Notion lookups are made.
export type SyncContext = {
	accessToken: string;
	workspaceId: string;
};

// Change-based conflict detection (conflict-007, replacing conflict-001's
// presence-based MVP): a Conflict is recorded only when a block's CONTENT
// actually changed between snapshots — the previous version (user1 side) vs the
// new version (user2 side), attributed to the real Notion editor via the
// last_edited_by metadata captured at sync time (sync.ts). Blocks merely synced
// by multiple connections but never edited are no longer flagged.
//
// Attribution: notionLastEditedBy (a Notion user id) maps to a Concord User via
// User.notionId. When there is no local match, team-006 Option B looks the editor
// up in Notion (users.retrieve) with the syncing user's token and persists them as
// a token-less "shadow" User, so a teammate who never connected via OAuth still
// shows their REAL Notion name/avatar on the conflict. Only when there is no token,
// no workspace, a lookup failure, or a non-person/bot editor do we fall back to the
// snapshot's syncing user. Either way every conflict side lands on a real User row
// (which the conflict-006 resolve flow's token lookup depends on). The same person
// on both sides still counts (maintainer-approved).
//
// Only the LATEST change per block is flagged per run: resolving an older
// change would write stale content over the block's current state via the
// conflict-006 write-back, so intermediate transitions stay in Snapshot history
// but are not flagged.
async function resolveEditor(
	notionEditorId: string | null,
	syncingUserId: number,
	usersByNotionId: Map<string, number>,
	notion: Client | null,
	workspaceId: string | null,
): Promise<number> {
	if (!notionEditorId) {
		return syncingUserId;
	}
	const mapped = usersByNotionId.get(notionEditorId);
	if (mapped !== undefined) {
		return mapped;
	}
	// Unmapped editor. Without a token/workspace we cannot name them, so keep
	// today's behaviour (attribute to the syncing user).
	if (!notion || !workspaceId) {
		return syncingUserId;
	}
	try {
		const editor = await notion.users.retrieve({ user_id: notionEditorId });
		// Only real people carry a name/email worth attributing; bots (API edits,
		// including our own write-back) and partial responses fall back.
		if (!("type" in editor) || editor.type !== "person" || !editor.name) {
			return syncingUserId;
		}
		// email is required + unique on User; a person may expose none (integration
		// capability / privacy), so synthesize a unique placeholder from the notionId.
		// If this person later connects, the OAuth upsert (auth.ts) overwrites it with
		// their real email, keyed on the same notionId.
		const email = editor.person?.email ?? `${notionEditorId}@unconnected.notion`;
		const shadow = await prisma.user.upsert({
			where: { notionId: notionEditorId },
			update: {},
			create: {
				notionId: notionEditorId,
				name: editor.name,
				avatar: editor.avatar_url ?? null,
				email,
				workspaceId,
				accessToken: null,
			},
			select: { id: true },
		});
		usersByNotionId.set(notionEditorId, shadow.id);
		return shadow.id;
	} catch (error) {
		// Never let a lookup (or a rare unique-email collision) crash detection.
		console.error(
			`[detect] users.retrieve failed for editor ${notionEditorId}; attributing to syncing user:`,
			error instanceof Error ? error.message : String(error),
		);
		return syncingUserId;
	}
}

// Treat never-captured (null) and genuinely-empty ("") content as the same
// value for change comparison, so pre-content-migration rows don't read as a
// change to "".
function norm(content: string | null): string {
	return content ?? "";
}

export async function detectConflicts(syncCtx?: SyncContext): Promise<ConflictSummary> {
	// team-006 Option B: name unmapped editors via Notion. No context -> no lookups,
	// attribution stays as it was (fall back to the syncing user).
	const notion = syncCtx ? new Client({ auth: syncCtx.accessToken }) : null;
	const syncWorkspaceId = syncCtx?.workspaceId ?? null;

	const users = await prisma.user.findMany({
		select: { id: true, notionId: true },
	});
	const usersByNotionId = new Map(users.map((user) => [user.notionId, user.id]));

	// Dedup set: every change already recorded, resolved conflicts included —
	// a resolved change must never resurrect as a new unresolved conflict.
	const existingConflicts = await prisma.conflict.findMany({
		where: { sourceSnapshotId: { not: null } },
		select: { sourceSnapshotId: true },
	});
	const existingSources = new Set(existingConflicts.map((c) => c.sourceSnapshotId));

	// Anti-loop data: keep-resolutions (conflict-006) record what they wrote
	// back to Notion in resolvedContent. The write-back itself changes the real
	// block, which the next sync captures as a new change — recognized and
	// suppressed below by content + time window.
	const resolutions = await prisma.conflict.findMany({
		where: { resolvedContent: { not: null } },
		select: { blockId: true, resolvedContent: true, resolvedAt: true },
	});
	const resolutionsByBlock = new Map<string, { resolvedContent: string; resolvedAt: Date | null }[]>();
	for (const resolution of resolutions) {
		if (!resolutionsByBlock.has(resolution.blockId)) {
			resolutionsByBlock.set(resolution.blockId, []);
		}
		resolutionsByBlock.get(resolution.blockId)!.push({
			resolvedContent: resolution.resolvedContent!,
			resolvedAt: resolution.resolvedAt,
		});
	}

	// Candidate blocks: one aggregate row per distinct NON-EMPTY (blockId,
	// content) — a block with 2+ distinct real contents has been edited from one
	// version to another at some point. Empty/never-captured content is excluded
	// here (and again in the scan below): a block whose only history is
	// null/"" -> text was authored, not edited, and has no previous version to
	// show. Unchanged blocks (the vast majority of the 60s poller's output) never
	// leave the DB, unlike the old full-table findMany.
	const contentGroups = await prisma.snapshot.groupBy({
		by: ["blockId", "content"],
		where: { AND: [{ content: { not: null } }, { content: { not: "" } }] },
	});
	const contentCountByBlock = new Map<string, number>();
	for (const group of contentGroups) {
		contentCountByBlock.set(group.blockId, (contentCountByBlock.get(group.blockId) ?? 0) + 1);
	}
	const candidateBlockIds = [...contentCountByBlock.entries()]
		.filter(([, count]) => count >= 2)
		.map(([blockId]) => blockId);

	if (candidateBlockIds.length === 0) {
		return { conflictsCreated: 0 };
	}

	const snapshots = await prisma.snapshot.findMany({
		where: { blockId: { in: candidateBlockIds } },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: {
			id: true,
			blockId: true,
			pageId: true,
			userId: true,
			content: true,
			notionLastEditedBy: true,
			notionLastEditedTime: true,
			createdAt: true,
		},
	});

	const snapshotsByBlock = new Map<string, typeof snapshots>();
	for (const snapshot of snapshots) {
		if (!snapshotsByBlock.has(snapshot.blockId)) {
			snapshotsByBlock.set(snapshot.blockId, []);
		}
		snapshotsByBlock.get(snapshot.blockId)!.push(snapshot);
	}

	let conflictsCreated = 0;

	for (const [blockId, chain] of snapshotsByBlock) {
		// Only non-empty snapshots are real "versions". A transition from empty or
		// never-captured content (norm() === "") to text is block authoring, not
		// an edit of an existing version — there is no previous version to show
		// side by side, so it must not be a conflict. Filtering these out also
		// collapses a transient empty read between two real versions (A, "", B),
		// so A -> B is still detected as one change. (Legacy pre-conflict-005
		// rows store null; genuinely empty blocks store "".)
		const versions = chain.filter((snapshot) => norm(snapshot.content) !== "");
		// Latest consecutive pair of real versions whose content differs.
		let prev: (typeof snapshots)[number] | null = null;
		let next: (typeof snapshots)[number] | null = null;
		for (let i = versions.length - 1; i >= 1; i -= 1) {
			if (norm(versions[i - 1].content) !== norm(versions[i].content)) {
				prev = versions[i - 1];
				next = versions[i];
				break;
			}
		}
		if (!prev || !next) {
			continue;
		}

		// Historical-noise guard: only changes whose NEW side carries real edit
		// metadata (captured post-migration) are flagged. The first run of this
		// logic creates zero conflicts out of weeks of pre-migration dev churn,
		// matching the clean-slate decision that deleted the 90 presence-based
		// false positives. (The prev side MAY be pre-migration — attribution
		// then falls back to its syncing user.)
		if (next.notionLastEditedTime === null) {
			continue;
		}

		// Dedup: this exact change (identified by its new-side snapshot) was
		// already recorded, whether still unresolved or since resolved.
		if (existingSources.has(next.id)) {
			continue;
		}

		// Anti-loop: this "change" is a conflict-006 write-back landing — the
		// resolution wrote exactly this content, and the pre-change snapshot
		// predates the resolution. A genuinely later human re-edit to the same
		// text has prev AFTER resolvedAt and is still flagged.
		const blockResolutions = resolutionsByBlock.get(blockId) ?? [];
		const isWritebackLanding = blockResolutions.some(
			(resolution) =>
				norm(resolution.resolvedContent) === norm(next.content) &&
				resolution.resolvedAt !== null &&
				resolution.resolvedAt >= prev.createdAt,
		);
		if (isWritebackLanding) {
			continue;
		}

		await prisma.conflict.create({
			data: {
				pageId: next.pageId,
				blockId,
				user1Id: await resolveEditor(prev.notionLastEditedBy, prev.userId, usersByNotionId, notion, syncWorkspaceId),
				user2Id: await resolveEditor(next.notionLastEditedBy, next.userId, usersByNotionId, notion, syncWorkspaceId),
				status: "unresolved",
				resolvedBy: "",
				user1Content: prev.content,
				user2Content: next.content,
				sourceSnapshotId: next.id,
			},
		});
		conflictsCreated += 1;
	}

	return { conflictsCreated };
}

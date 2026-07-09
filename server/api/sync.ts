import express from "express";
import type { Request, Response } from "express";
import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "../lib/sync.js";
import { detectConflicts } from "../lib/conflict.js";
import { emitConflictsCreated } from "../lib/conflictEvents.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
	try {
		const user = await prisma.user.findFirst({ where: { accessToken: { not: null } } });

		if (!user) {
			res.status(404).json({ message: "No connected workspace found. Connect Notion first." });
			return;
		}

		const summary = await syncWorkspaceForUser(user);

		// Detect conflicts on the freshly captured snapshots so a manual "Sync Now"
		// surfaces new conflicts immediately, not just fresh page content. Same
		// safety as the poll: change-based detection with dedup + the write-back
		// anti-loop means re-running creates nothing for unchanged/known blocks.
		// Emit on real creations so the live dashboard updates without a refresh.
		const detection = await detectConflicts(
			user.accessToken ? { accessToken: user.accessToken, workspaceId: user.workspaceId } : undefined,
		);
		if (detection.conflictsCreated > 0) {
			emitConflictsCreated({ pageId: null, count: detection.conflictsCreated });
		}

		res.status(200).json({
			workspaceId: user.workspaceId,
			pages: summary.pages,
			snapshots: summary.snapshots,
			conflictsCreated: detection.conflictsCreated,
			syncedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Manual sync failed:", error instanceof Error ? error.message : String(error));
		res.status(500).json({
			message: "Sync failed.",
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

export default router;

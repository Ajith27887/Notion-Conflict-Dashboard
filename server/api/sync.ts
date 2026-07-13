import express from "express";
import type { Request, Response } from "express";
import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "../lib/sync.js";
import { detectConflicts } from "../lib/conflict.js";
import { emitConflictsCreated } from "../lib/conflictEvents.js";
import { verifyServiceToken } from "../lib/authToken.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
	try {
		// Public app: the browser no longer calls this directly. The Next /api/sync
		// route handler resolves the logged-in user from the session cookie and calls
		// us with a signed service token, so we act on THAT user/workspace instead of
		// guessing "the first connected user".
		const claims = verifyServiceToken(req);
		if (!claims) {
			res.status(401).json({ message: "Missing or invalid service token." });
			return;
		}

		const user = await prisma.user.findUnique({ where: { id: claims.userId } });
		if (!user || user.workspaceId !== claims.workspaceId) {
			res.status(401).json({ message: "Session user not found." });
			return;
		}
		if (!user.accessToken) {
			res.status(409).json({ message: "This account is not connected to Notion. Reconnect and try again." });
			return;
		}

		const summary = await syncWorkspaceForUser(user);

		// Detect conflicts on the freshly captured snapshots so a manual "Sync Now"
		// surfaces new conflicts immediately, not just fresh page content. Same
		// safety as the poll: change-based detection with dedup + the write-back
		// anti-loop means re-running creates nothing for unchanged/known blocks.
		// Emit on real creations so the live dashboard updates without a refresh.
		const detection = await detectConflicts(user.workspaceId, {
			accessToken: user.accessToken,
			workspaceId: user.workspaceId,
		});
		if (detection.conflictsCreated > 0) {
			emitConflictsCreated({ workspaceId: user.workspaceId, pageId: null, count: detection.conflictsCreated });
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

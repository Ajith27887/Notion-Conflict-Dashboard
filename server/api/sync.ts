import express from "express";
import type { Request, Response } from "express";
import prisma from "../PrismaClient.js";
import { syncWorkspaceForUser } from "../lib/sync.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
	try {
		const user = await prisma.user.findFirst({ where: { accessToken: { not: null } } });

		if (!user) {
			res.status(404).json({ message: "No connected workspace found. Connect Notion first." });
			return;
		}

		const summary = await syncWorkspaceForUser(user);
		res.status(200).json({
			workspaceId: user.workspaceId,
			pages: summary.pages,
			snapshots: summary.snapshots,
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

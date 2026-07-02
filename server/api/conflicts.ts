import express from "express";
import type { Request, Response } from "express";
import prisma from "../PrismaClient.js";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
	try {
		const conflicts = await prisma.conflict.findMany({
			where: { status: "unresolved" },
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json(conflicts);
	} catch (error) {
		console.error("Failed to list conflicts:", error instanceof Error ? error.message : String(error));
		res.status(500).json({
			message: "Failed to list conflicts.",
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

export default router;

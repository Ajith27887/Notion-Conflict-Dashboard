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

router.patch("/:id/resolve", async (req: Request, res: Response) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ message: "Invalid conflict id." });
		return;
	}

	const resolvedByRaw = req.body?.resolvedBy;
	const resolvedBy = typeof resolvedByRaw === "string" ? resolvedByRaw.trim() : "";
	if (!resolvedBy) {
		res.status(400).json({ message: "resolvedBy is required." });
		return;
	}

	try {
		const existing = await prisma.conflict.findUnique({ where: { id } });
		if (!existing) {
			res.status(404).json({ message: "Conflict not found." });
			return;
		}

		const updated = await prisma.conflict.update({
			where: { id },
			data: {
				status: "resolved",
				resolvedBy,
				resolvedAt: new Date(),
			},
		});

		res.status(200).json(updated);
	} catch (error) {
		console.error("Failed to resolve conflict:", error instanceof Error ? error.message : String(error));
		res.status(500).json({
			message: "Failed to resolve conflict.",
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

export default router;

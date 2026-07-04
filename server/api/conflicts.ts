import express from "express";
import type { Request, Response } from "express";
import prisma from "../PrismaClient.js";
import { writeBlockContent, UnsupportedBlockTypeError } from "../lib/notionWriteback.js";

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

	// `keep` is optional: absent means the original conflict-004 contract (mark
	// resolved in Concord only, no Notion call). When present it names which
	// side's content gets written back to the real Notion block, and the DB
	// update only happens after that write succeeds — "resolved" must never
	// claim a write-back that didn't happen.
	const keepRaw = req.body?.keep;
	if (keepRaw !== undefined && keepRaw !== "user1" && keepRaw !== "user2") {
		res.status(400).json({ message: "keep must be 'user1' or 'user2'." });
		return;
	}
	const keep = keepRaw as "user1" | "user2" | undefined;

	try {
		const existing = await prisma.conflict.findUnique({
			where: { id },
			include: { user1: true, user2: true },
		});
		if (!existing) {
			res.status(404).json({ message: "Conflict not found." });
			return;
		}

		if (keep !== undefined) {
			const keptContent = keep === "user1" ? existing.user1Content : existing.user2Content;
			// null = never captured (pre-migration rows); "" is legitimate empty text
			// and is allowed through (writing it clears the block).
			if (keptContent === null) {
				res.status(422).json({
					message: "Kept side has no captured content to write back to Notion.",
				});
				return;
			}

			const keptUser = keep === "user1" ? existing.user1 : existing.user2;
			const otherUser = keep === "user1" ? existing.user2 : existing.user1;
			const accessToken = keptUser.accessToken ?? otherUser.accessToken;
			if (!accessToken) {
				res.status(422).json({
					message: "No Notion access token available for either conflict participant.",
				});
				return;
			}

			try {
				await writeBlockContent({ accessToken, blockId: existing.blockId, content: keptContent });
			} catch (notionError) {
				console.error(
					"Notion write-back failed:",
					notionError instanceof Error ? notionError.message : String(notionError),
				);
				if (notionError instanceof UnsupportedBlockTypeError) {
					res.status(422).json({ message: notionError.message });
					return;
				}
				res.status(502).json({
					message: "Failed to write the kept content back to Notion. The conflict was not marked resolved.",
					error: notionError instanceof Error ? notionError.message : String(notionError),
				});
				return;
			}
		}

		const updated = await prisma.conflict.update({
			where: { id },
			data: {
				status: "resolved",
				resolvedBy,
				resolvedAt: new Date(),
				// Record what a keep-resolution actually wrote back to Notion so
				// detectConflicts() can recognize the write-back landing on the next
				// sync and not flag it as a new change (conflict-007 anti-loop).
				// Legacy keep-less resolutions leave it null — they wrote nothing.
				...(keep !== undefined
					? { resolvedContent: keep === "user1" ? existing.user1Content : existing.user2Content }
					: {}),
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

import express from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import prisma from "../PrismaClient.js";
import { syncPageForUser, syncWorkspaceForUser } from "../lib/sync.js";
import { detectConflicts } from "../lib/conflict.js";
import { emitConflictsCreated } from "../lib/conflictEvents.js";

const router = express.Router();

// Where the one-time verification token is persisted for the maintainer to copy
// into .env. Git-ignored (.notion-webhook-token); the value is a secret and is
// never written to the log stream.
const TOKEN_FILE = fileURLToPath(new URL("../.notion-webhook-token", import.meta.url));

// Notion signs every event with HMAC-SHA256 over the RAW request body, keyed by the
// subscription's verification_token, and sends it as `X-Notion-Signature: sha256=<hex>`
// (confirmed against developers.notion.com/reference/webhooks). Compare in constant
// time; never act on a payload whose signature we can't verify.
function verifySignature(token: string, rawBody: Buffer, header: string | undefined): boolean {
	if (!header) {
		return false;
	}
	const expected = "sha256=" + crypto.createHmac("sha256", token).update(rawBody).digest("hex");
	const expectedBuf = Buffer.from(expected);
	const actualBuf = Buffer.from(header);
	// timingSafeEqual throws on a length mismatch — guard first (also short-circuits
	// an obviously wrong header without leaking timing on the length).
	if (expectedBuf.length !== actualBuf.length) {
		return false;
	}
	return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Prefix so webhook activity is easy to grep in the mixed server log.
const LOG = "[webhook]";

// Off the response path: a verified event has already been 200-acked. Only a page
// content change drives a sync + detect. Errors are logged, never thrown (there is
// no response left to fail).
async function handleEvent(body: Record<string, unknown>): Promise<void> {
	const type = typeof body.type === "string" ? body.type : "(none)";
	const entity = (body.entity ?? {}) as { id?: unknown; type?: unknown };
	const attempt = body.attempt_number ?? "?";
	console.log(`${LOG} handling event type=${type} entity.type=${entity.type} entity.id=${entity.id} attempt=${attempt}`);

	if (type !== "page.content_updated" || entity.type !== "page" || typeof entity.id !== "string") {
		console.log(`${LOG} skipped: not a page.content_updated event on a page (no sync/detect run).`);
		return;
	}
	const notionPageId = entity.id;

	// Webhook payloads carry no token — reuse the same "first connected user" the
	// poller (sync-002) and POST /sync (sync-004) already select.
	const user = await prisma.user.findFirst({ where: { accessToken: { not: null } } });
	if (!user) {
		console.log(`${LOG} skipped: no connected user with a Notion access token.`);
		return;
	}
	console.log(`${LOG} using connected user id=${user.id} workspace=${user.workspaceId}`);

	// Fast path: page-scoped sync when we already track the page. Otherwise fall back
	// to a full workspace sync so a brand-new (or id-format-mismatched) page is still
	// captured — Notion's entity.id and our stored notionPageId are both UUIDs but may
	// differ in dashing, and the fallback keeps that from silently dropping an edit.
	const tracked = await prisma.page.findUnique({ where: { notionPageId } });
	let summary;
	if (tracked) {
		console.log(`${LOG} page is tracked (local page id=${tracked.id}) -> page-scoped sync.`);
		summary = await syncPageForUser(user, notionPageId);
	} else {
		console.log(`${LOG} page ${notionPageId} not tracked locally -> full workspace sync fallback.`);
		summary = await syncWorkspaceForUser(user);
	}
	console.log(`${LOG} sync done: ${summary.pages} page(s), ${summary.snapshots} snapshot(s). Running detection...`);

	const detection = await detectConflicts();
	console.log(
		`${LOG} DONE for page ${notionPageId}: ${detection.conflictsCreated} conflict(s) created ` +
			`(${detection.conflictsCreated === 0 ? "no content change detected or already recorded" : "check the dashboard"}).`,
	);

	// dash-005: push the open dashboard(s) so a new conflict appears live. Only
	// signal on a real creation — a zero-change run sends nothing, so an idle
	// dashboard never flickers. tracked?.id is the local Page.id (null on the
	// full-workspace fallback path).
	if (detection.conflictsCreated > 0) {
		emitConflictsCreated({ pageId: tracked?.id ?? null, count: detection.conflictsCreated });
	}
}

router.post("/notion", async (req: Request, res: Response) => {
	const body = (req.body ?? {}) as Record<string, unknown>;
	console.log(
		`${LOG} inbound POST /webhooks/notion ` +
			`(type=${body.type ?? "n/a"}, signature ${req.header("X-Notion-Signature") ? "present" : "absent"}).`,
	);

	// One-time subscription verification handshake: Notion POSTs
	// { verification_token }. Persist it (git-ignored) for the maintainer to copy
	// into .env as NOTION_WEBHOOK_TOKEN, ack 200, and never log the value itself.
	if (typeof body.verification_token === "string") {
		try {
			fs.writeFileSync(TOKEN_FILE, body.verification_token, { encoding: "utf8", mode: 0o600 });
			console.log(
				`${LOG} verification token received and written to ${TOKEN_FILE}. ` +
					"Copy it into .env as NOTION_WEBHOOK_TOKEN (value not logged), then restart the server.",
			);
		} catch (error) {
			console.error(
				`${LOG} failed to persist verification token:`,
				error instanceof Error ? error.message : String(error),
			);
		}
		res.status(200).json({ ok: true });
		return;
	}

	// Every real event must carry a valid signature keyed by the stored token.
	// Distinguish the failure reasons so a live misconfiguration is obvious in the log.
	const token = process.env.NOTION_WEBHOOK_TOKEN;
	const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
	if (!token) {
		console.warn(`${LOG} dropped: NOTION_WEBHOOK_TOKEN is not set in .env — cannot verify signature.`);
		res.status(401).json({ message: "Invalid signature." });
		return;
	}
	if (!rawBody) {
		console.warn(`${LOG} dropped: no raw request body captured (express.json verify hook missing?).`);
		res.status(401).json({ message: "Invalid signature." });
		return;
	}
	if (!verifySignature(token, rawBody, req.header("X-Notion-Signature"))) {
		console.warn(`${LOG} dropped: X-Notion-Signature did not match (bad/missing signature or wrong token).`);
		res.status(401).json({ message: "Invalid signature." });
		return;
	}

	// Ack fast so Notion does not time out and retry (up to 8x over ~24h), then do
	// the sync + detect work off the response path.
	console.log(`${LOG} signature verified -> acking 200, processing off the response path.`);
	res.status(200).json({ ok: true });
	setImmediate(() => {
		void handleEvent(body).catch((error) => {
			console.error(
				"Notion webhook processing failed:",
				error instanceof Error ? error.message : String(error),
			);
		});
	});
});

export default router;

import express from "express";
import type { Request, Response } from "express";
import { conflictEvents, type ConflictsCreatedEvent } from "../lib/conflictEvents.js";

const router = express.Router();

// dash-005: Server-Sent Events stream. The browser dashboard opens an EventSource
// to GET /events and revalidates whenever a new Conflict is pushed here, so an
// open, untouched dashboard reflects a Notion edit within seconds — no refresh,
// no button click. One-directional (server -> client), which is exactly what SSE
// is for; EventSource also reconnects on its own, covering the resilience case.
//
// The global cors(corsOptions) middleware already allows the http://localhost:3000
// origin the EventSource GET sends, and the global express.json({ verify }) hook is
// a no-op on this bodyless GET — neither needs a change.
router.get("/", (req: Request, res: Response) => {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});
	// Open the stream immediately (a comment frame) and hint the client's auto-reconnect delay.
	res.write("retry: 3000\n\n");
	res.write(": connected\n\n");

	const onConflict = (payload: ConflictsCreatedEvent) => {
		res.write(`data: ${JSON.stringify(payload)}\n\n`);
	};
	conflictEvents.on("conflictsCreated", onConflict);

	// Keep the connection alive through idle proxies/tunnels and detect a dead
	// client. A comment frame (": ...") is ignored by EventSource.
	const heartbeat = setInterval(() => {
		res.write(": ping\n\n");
	}, 25000);

	// Reconnects are frequent by design, so BOTH the timer and the listener must be
	// released on disconnect — leaking either accumulates one per reconnect.
	req.on("close", () => {
		clearInterval(heartbeat);
		conflictEvents.off("conflictsCreated", onConflict);
		res.end();
	});
});

export default router;

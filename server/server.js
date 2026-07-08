import express from "express";
import auth from "./api/auth.ts"
import sync from "./api/sync.ts"
import conflicts from "./api/conflicts.ts"
import webhooks from "./api/webhooks.ts"
import events from "./api/events.ts"
import cors from "cors";
import { startSyncPolling, stopSyncPolling } from "./lib/syncScheduler.ts";

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
	origin: "http://localhost:3000",
	method: "GET, POST",
	allowedHeaders: ['Content-Type', "Authorization"]
}

app.use(cors(corsOptions))
// Capture the raw request bytes as req.rawBody while still parsing JSON into req.body
// for every route. The Notion webhook (sync-005) needs the exact bytes Notion signed
// for HMAC verification; all other routes are unaffected.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use("/auth", auth);
app.use("/sync", sync);
app.use("/conflicts", conflicts);
app.use("/webhooks", webhooks);
app.use("/events", events);

const server = app.listen(PORT, () => {
	console.log(`Server is listing to ${PORT}`);
	startSyncPolling();
})

// Keep an explicit reference so the listening server isn't garbage-collected
// (which would close the socket and let the process exit).
process.on("SIGINT", () => { stopSyncPolling(); server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { stopSyncPolling(); server.close(() => process.exit(0)); });
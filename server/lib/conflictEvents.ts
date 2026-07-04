import { EventEmitter } from "events";

// In-process signal channel for dash-005's live dashboard. Node caches modules
// per process, so every importer inside the Express process (the webhook handler
// that creates conflicts, and the SSE endpoint that serves browser clients) shares
// this one EventEmitter instance. That co-location is why the signal never needs a
// broker: the only path that creates a Conflict in-process is the sync-005 webhook
// handler, and the SSE clients live in the same process.
export const conflictEvents = new EventEmitter();

// One listener is added per open dashboard tab (SSE connection) and removed on
// disconnect; there is no fixed upper bound, so disable the default 10-listener
// warning rather than have it fire on the 11th open tab.
conflictEvents.setMaxListeners(0);

export type ConflictsCreatedEvent = {
	// The local Page.id the conflict(s) landed on (null when a full-workspace
	// fallback sync ran, i.e. the edited page was not tracked). The browser client
	// ignores the payload and simply revalidates; this is carried per the feature
	// spec ("at least the new conflict id(s)/pageId").
	pageId: number | null;
	count: number;
};

export function emitConflictsCreated(payload: ConflictsCreatedEvent): void {
	conflictEvents.emit("conflictsCreated", payload);
}

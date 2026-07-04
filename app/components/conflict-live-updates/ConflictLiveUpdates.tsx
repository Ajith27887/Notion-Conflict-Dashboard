"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

// dash-005: opens a Server-Sent Events stream to the Express server and, on each
// push (a new conflict was detected server-side, e.g. via the sync-005 webhook),
// revalidates the dashboard's Server Component so the new conflict appears with no
// page reload and no button click. Behavior-only — renders nothing.
const EVENTS_ENDPOINT = "http://localhost:3001/events";

export default function ConflictLiveUpdates() {
	const router = useRouter();
	const [, startTransition] = useTransition();

	useEffect(() => {
		const source = new EventSource(EVENTS_ENDPOINT);
		source.onmessage = () => {
			// Same revalidation path SyncNowButton/ResolveConflictButtons use:
			// router.refresh() re-queries Prisma in the Server Component and swaps in
			// the new markup without a full document reload. startTransition keeps it
			// non-blocking.
			startTransition(() => {
				router.refresh();
			});
		};
		// No onerror handler needed: EventSource reconnects on its own after a drop
		// (the server also sends `retry: 3000`), which is the resilience requirement.
		return () => source.close();
	}, [router, startTransition]);

	return null;
}

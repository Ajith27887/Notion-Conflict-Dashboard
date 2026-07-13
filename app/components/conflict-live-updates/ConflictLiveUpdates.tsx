"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/app/lib/api";

// dash-005: opens a Server-Sent Events stream to the Express server and, on each
// push (a new conflict was detected server-side, e.g. via the sync-005 webhook),
// revalidates the dashboard's Server Component so the new conflict appears with no
// page reload and no button click. Behavior-only — renders nothing.
//
// Public app: the stream is subscribed with the viewer's workspaceId so it only
// revalidates on this tenant's conflicts (the Express /events endpoint filters).

type ConflictLiveUpdatesProps = {
	workspaceId: string;
};

export default function ConflictLiveUpdates({ workspaceId }: ConflictLiveUpdatesProps) {
	const router = useRouter();
	const [, startTransition] = useTransition();

	useEffect(() => {
		const source = new EventSource(apiUrl(`/events?workspaceId=${encodeURIComponent(workspaceId)}`));
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
	}, [router, startTransition, workspaceId]);

	return null;
}

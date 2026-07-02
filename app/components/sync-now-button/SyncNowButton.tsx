"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const SYNC_ENDPOINT = "http://localhost:3001/sync";

export default function SyncNowButton() {
	const router = useRouter();
	const [isFetching, setIsFetching] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// router.refresh() doesn't return a promise, so awaiting the fetch alone
	// would re-enable the button before the refreshed Server Component data
	// actually paints. Wrapping it in startTransition keeps isPending true
	// until that re-render commits.
	const isSyncing = isFetching || isPending;

	const handleSyncNow = async () => {
		setIsFetching(true);
		setError(null);
		try {
			const response = await fetch(SYNC_ENDPOINT, { method: "POST" });
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.message ?? `Sync failed (${response.status}).`);
			}
			startTransition(() => {
				router.refresh();
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sync failed. Try again.");
		} finally {
			setIsFetching(false);
		}
	};

	return (
		<div className="flex flex-col items-end gap-1">
			<button
				type="button"
				onClick={handleSyncNow}
				disabled={isSyncing}
				aria-busy={isSyncing}
				className="rounded-2xl bg-black px-5 py-2 font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isSyncing ? "Syncing…" : "Sync Now"}
			</button>
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}

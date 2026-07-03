"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CONFLICTS_ENDPOINT = "http://localhost:3001/conflicts";

type Side = "user1" | "user2";

type ResolveConflictButtonsProps = {
	conflictId: number;
	user1Label: string;
	user2Label: string;
};

export default function ResolveConflictButtons({
	conflictId,
	user1Label,
	user2Label,
}: ResolveConflictButtonsProps) {
	const router = useRouter();
	const [resolvingSide, setResolvingSide] = useState<Side | null>(null);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const isResolving = resolvingSide !== null || isPending;

	const handleResolve = async (side: Side) => {
		setResolvingSide(side);
		setError(null);
		try {
			const resolvedBy = side === "user1" ? user1Label : user2Label;
			const response = await fetch(`${CONFLICTS_ENDPOINT}/${conflictId}/resolve`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resolvedBy }),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.message ?? `Resolve failed (${response.status}).`);
			}
			// Not reset here on success: the Dashboard's conflicts query is filtered
			// to status="unresolved", so once router.refresh() re-runs it this card
			// is removed from the list entirely — there's nothing left to re-enable.
			startTransition(() => {
				router.refresh();
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Resolve failed. Try again.");
			setResolvingSide(null);
		}
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="flex gap-3">
				<button
					type="button"
					onClick={() => handleResolve("user1")}
					disabled={isResolving}
					aria-busy={resolvingSide === "user1"}
					className="rounded-2xl bg-black px-4 py-2 text-sm font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
				>
					{resolvingSide === "user1" ? "Resolving…" : `Keep ${user1Label}`}
				</button>
				<button
					type="button"
					onClick={() => handleResolve("user2")}
					disabled={isResolving}
					aria-busy={resolvingSide === "user2"}
					className="rounded-2xl bg-black px-4 py-2 text-sm font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
				>
					{resolvingSide === "user2" ? "Resolving…" : `Keep ${user2Label}`}
				</button>
			</div>
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}

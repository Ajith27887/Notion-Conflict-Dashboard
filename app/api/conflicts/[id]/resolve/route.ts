// Public app: same-origin resolve endpoint. Resolves the logged-in user from the
// session cookie and forwards the resolve to Express with a signed service token,
// which enforces that the conflict belongs to this user's workspace.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, signServiceToken } from "@/app/lib/session";
import { apiUrl } from "@/app/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
	const session = await getSessionUser();
	if (!session) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id } = await context.params;
	// Pass the caller's JSON body (resolvedBy, keep) straight through.
	const body = await request.text();

	const serviceToken = await signServiceToken(session);
	try {
		const upstream = await fetch(apiUrl(`/conflicts/${encodeURIComponent(id)}/resolve`), {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${serviceToken}`,
				"Content-Type": "application/json",
			},
			body,
			cache: "no-store",
		});
		const responseBody = await upstream.text();
		return new NextResponse(responseBody, {
			status: upstream.status,
			headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
		});
	} catch (error) {
		return NextResponse.json(
			{ message: "Resolve service is unreachable.", error: error instanceof Error ? error.message : String(error) },
			{ status: 502 },
		);
	}
}

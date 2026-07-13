// Public app: the browser calls THIS same-origin route (so the httpOnly session
// cookie is sent) instead of Express directly. We resolve the logged-in user from
// the cookie, then call Express with a short-lived signed service token so Express
// acts on this exact user/workspace. The Notion access token never touches the
// browser.
import { NextResponse } from "next/server";
import { getSessionUser, signServiceToken } from "@/app/lib/session";
import { apiUrl } from "@/app/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
	const session = await getSessionUser();
	if (!session) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const serviceToken = await signServiceToken(session);
	try {
		const upstream = await fetch(apiUrl("/sync"), {
			method: "POST",
			headers: { Authorization: `Bearer ${serviceToken}` },
			cache: "no-store",
		});
		// Relay Express's status + body so the button shows the real result/error.
		const body = await upstream.text();
		return new NextResponse(body, {
			status: upstream.status,
			headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
		});
	} catch (error) {
		return NextResponse.json(
			{ message: "Sync service is unreachable.", error: error instanceof Error ? error.message : String(error) },
			{ status: 502 },
		);
	}
}

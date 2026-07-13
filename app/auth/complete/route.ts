// OAuth handoff landing (public app conversion). Express's /auth/callback finishes
// the Notion OAuth exchange, upserts the User, then redirects the browser here with
// a short-lived handoff JWT. We verify it and mint a first-party httpOnly session
// cookie on THIS (Vercel) domain — solving the cross-domain cookie problem: Express
// runs on a different host and can't set a cookie the Next server can read.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken, signSessionToken } from "@/app/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token");
	if (!token) {
		return NextResponse.redirect(new URL("/?error=auth", request.url));
	}

	const claims = await verifyToken(token);
	if (!claims) {
		// Bad signature, expired handoff, or wrong shape — send back to login.
		return NextResponse.redirect(new URL("/?error=auth", request.url));
	}

	const sessionValue = await signSessionToken(claims);
	const response = NextResponse.redirect(new URL("/Dashboard", request.url));
	response.cookies.set(SESSION_COOKIE, sessionValue, {
		httpOnly: true,
		// Secure in prod (https). Allow http on localhost so local dev login works.
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30, // 30 days, matches the session token TTL
	});
	return response;
}

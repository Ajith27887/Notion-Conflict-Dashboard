// Clears the session cookie and returns to the login page. Handy for testing
// multiple Notion accounts on one machine, and the natural "sign out" endpoint.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/app/lib/session";

export const dynamic = "force-dynamic";

function clear(request: NextRequest) {
	const response = NextResponse.redirect(new URL("/", request.url));
	response.cookies.set(SESSION_COOKIE, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
	return response;
}

export function GET(request: NextRequest) {
	return clear(request);
}

export function POST(request: NextRequest) {
	return clear(request);
}

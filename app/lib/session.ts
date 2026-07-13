// Session + service-token helpers for the public (multi-tenant) app. The Next app
// "owns identity": after Notion OAuth, Express hands off a short-lived JWT that the
// /auth/complete route exchanges for a first-party httpOnly session cookie set on
// this (Vercel) domain. Server Components and route handlers resolve the logged-in
// user from that cookie and scope every query to their workspace.
//
// All tokens are HS256 over AUTH_SHARED_SECRET (shared with Express, which uses
// jsonwebtoken — HS256 is interoperable across the two libraries). The secret is
// server-only (never NEXT_PUBLIC_) so it is never shipped to the browser.
// This module is only imported from Server Components and route handlers; the
// next/headers import below hard-fails if it is ever pulled into a Client Component.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "concord_session";

// Long-lived browser session; the handoff/service tokens are deliberately short.
const SESSION_TTL = "30d";
const SERVICE_TTL = "60s";

export type SessionUser = {
	userId: number;
	workspaceId: string;
};

function secretKey(): Uint8Array {
	const secret = process.env.AUTH_SHARED_SECRET;
	if (!secret) {
		// Fail loud in logs; callers treat a thrown/rejected verify as "no session".
		throw new Error("AUTH_SHARED_SECRET is not set — cannot sign/verify session tokens.");
	}
	return new TextEncoder().encode(secret);
}

// Narrow an untrusted JWT payload to our SessionUser shape.
function toSessionUser(payload: JWTPayload): SessionUser | null {
	const userId = payload.userId;
	const workspaceId = payload.workspaceId;
	if (typeof userId !== "number" || !Number.isInteger(userId)) {
		return null;
	}
	if (typeof workspaceId !== "string" || workspaceId.length === 0) {
		return null;
	}
	return { userId, workspaceId };
}

async function signToken(claims: SessionUser, ttl: string): Promise<string> {
	return new SignJWT({ userId: claims.userId, workspaceId: claims.workspaceId })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(ttl)
		.sign(secretKey());
}

// Verify any of our HS256 tokens (handoff from Express, or our own session cookie).
// Returns null on any failure (bad signature, expired, wrong shape) so callers can
// treat it as "not authenticated" without try/catch noise.
export async function verifyToken(token: string): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
		return toSessionUser(payload);
	} catch {
		return null;
	}
}

// Value written into the httpOnly session cookie by /auth/complete.
export function signSessionToken(claims: SessionUser): Promise<string> {
	return signToken(claims, SESSION_TTL);
}

// Short-lived assertion the Next route handlers send to Express (Authorization:
// Bearer) so Express acts on THIS user instead of guessing "the first connected
// user". Never exposed to the browser.
export function signServiceToken(claims: SessionUser): Promise<string> {
	return signToken(claims, SERVICE_TTL);
}

// Resolve the logged-in user from the request's session cookie. Null when there is
// no valid session — callers redirect to "/" (pages) or return 401 (route handlers).
export async function getSessionUser(): Promise<SessionUser | null> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	if (!token) {
		return null;
	}
	return verifyToken(token);
}

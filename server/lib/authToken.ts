import jwt from "jsonwebtoken";
import type { Request } from "express";

// HS256 tokens shared with the Next app over AUTH_SHARED_SECRET (public app
// conversion). Express mints the OAuth handoff token the browser carries to the
// Next /auth/complete route, and verifies the service token the Next route handlers
// send (Authorization: Bearer) so this server acts on the ASSERTED user instead of
// guessing "the first connected user". jose (Next) and jsonwebtoken (here) are
// interoperable for HS256, so both sides trust each other's tokens.
export type TokenClaims = {
	userId: number;
	workspaceId: string;
};

function secret(): string {
	const value = process.env.AUTH_SHARED_SECRET;
	if (!value) {
		throw new Error("AUTH_SHARED_SECRET is not set — cannot sign/verify handoff or service tokens.");
	}
	return value;
}

// Short-lived (~60s) token handed to the browser after OAuth; it only has to
// survive one redirect to the Next /auth/complete route.
export function signHandoffToken(claims: TokenClaims): string {
	return jwt.sign({ userId: claims.userId, workspaceId: claims.workspaceId }, secret(), {
		algorithm: "HS256",
		expiresIn: "60s",
	});
}

// Validate an untrusted decoded payload down to TokenClaims.
function toClaims(decoded: unknown): TokenClaims | null {
	if (typeof decoded !== "object" || decoded === null) {
		return null;
	}
	const { userId, workspaceId } = decoded as Record<string, unknown>;
	if (typeof userId !== "number" || !Number.isInteger(userId)) {
		return null;
	}
	if (typeof workspaceId !== "string" || workspaceId.length === 0) {
		return null;
	}
	return { userId, workspaceId };
}

// Read + verify the service token from an Authorization: Bearer header. Returns
// null on a missing/malformed/expired/invalid token so callers respond 401.
export function verifyServiceToken(req: Request): TokenClaims | null {
	const header = req.header("Authorization") ?? req.header("authorization");
	if (!header || !header.startsWith("Bearer ")) {
		return null;
	}
	const token = header.slice("Bearer ".length).trim();
	if (!token) {
		return null;
	}
	try {
		return toClaims(jwt.verify(token, secret(), { algorithms: ["HS256"] }));
	} catch {
		return null;
	}
}

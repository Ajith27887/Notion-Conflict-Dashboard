// Base URL for the backend Express API. Configured via NEXT_PUBLIC_API_URL so the
// same build can point at localhost during dev and the deployed server in prod.
// Falls back to the local dev server when the env var is unset.
export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Join the API base with a path, tolerating a leading slash on the path.
export function apiUrl(path: string): string {
	return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

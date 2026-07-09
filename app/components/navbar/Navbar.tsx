"use client";

import { useRouter } from "next/navigation";

export default function Navbar() {
	const router = useRouter();

	// Auth state lives only in the database (the OAuth callback upserts the user
	// and redirects here); there is no browser cookie/session to tear down. So
	// "logging out of Notion" means returning the user to the login screen, where
	// they can re-authorize with a different workspace/account.
	const handleLogout = () => {
		router.push("/");
	};

	return (
		<nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-4">
			<span className="text-lg font-bold text-zinc-900">Concord</span>
			<button
				type="button"
				onClick={handleLogout}
				className="rounded-2xl bg-black px-5 py-2 font-bold text-white cursor-pointer"
			>
				Log out
			</button>
		</nav>
	);
}

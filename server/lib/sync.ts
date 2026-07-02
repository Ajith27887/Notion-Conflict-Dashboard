import { Client } from "@notionhq/client";
import type {
	PageObjectResponse,
	PartialPageObjectResponse,
	PartialDataSourceObjectResponse,
	DataSourceObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import prisma from "../PrismaClient.js";

// Minimal shape of the connected user this routine needs. Kept structural so it
// can be called with a full Prisma User row (sync-002 interval, sync-004 POST /sync)
// or a hand-built object without importing the generated type here.
export type ConnectedUser = {
	id: number;
	workspaceId: string;
	accessToken: string | null;
};

export type SyncSummary = {
	pages: number;
	snapshots: number;
};

type SearchResult =
	| PageObjectResponse
	| PartialPageObjectResponse
	| PartialDataSourceObjectResponse
	| DataSourceObjectResponse;

// Pull the plain-text title out of a full page object's properties. Notion stores
// the title under whichever property has type "title" (usually named "Name"/"title").
function extractTitle(page: PageObjectResponse): string {
	for (const property of Object.values(page.properties)) {
		if (property.type === "title") {
			return property.title[0]?.plain_text ?? "Untitled";
		}
	}
	return "Untitled";
}

// Fetch the connected user's Notion pages and snapshot each page's top-level blocks
// into Postgres. This is the durable, reusable routine: sync-002 (60s interval) and
// sync-004 (POST /sync) both call it. It never logs the access token.
//
// MVP limitations (see feature_list.json sync-001): no pagination (first ~100 pages
// and first ~100 blocks per page), no recursion into nested block children, and no
// block content is stored (Snapshot has no content column yet — conflict-001 owns
// adding it).
export async function syncWorkspaceForUser(user: ConnectedUser): Promise<SyncSummary> {
	if (!user.accessToken) {
		throw new Error("Cannot sync: user has no Notion access token.");
	}

	const notion = new Client({ auth: user.accessToken });

	const search = await notion.search({
		filter: { property: "object", value: "page" },
	});

	let pageCount = 0;
	let snapshotCount = 0;

	for (const result of search.results as SearchResult[]) {
		// Partial results (and data-source results) have no `properties`; skip them.
		if (result.object !== "page" || !("properties" in result)) {
			continue;
		}
		const page = result as PageObjectResponse;

		try {
			const title = extractTitle(page);

			// Upsert on the stable notionPageId. `tittle` is misspelled in the schema
			// and is @unique — a duplicate title (e.g. two "Untitled" pages) throws a
			// unique violation, so the whole per-page block is guarded and we skip the
			// offender rather than aborting the entire sync.
			const localPage = await prisma.page.upsert({
				where: { notionPageId: page.id },
				update: {
					tittle: title,
					workspaceId: user.workspaceId,
				},
				create: {
					notionPageId: page.id,
					tittle: title,
					workspaceId: user.workspaceId,
				},
			});
			pageCount += 1;

			const blocks = await notion.blocks.children.list({ block_id: page.id });
			for (const block of blocks.results) {
				await prisma.snapshot.create({
					data: {
						blockId: block.id,
						pageId: localPage.id,
						userId: user.id,
					},
				});
				snapshotCount += 1;
			}
		} catch (error) {
			// Log and continue so one bad page (e.g. duplicate title) does not abort
			// the run. Never include the access token in logs.
			console.error(
				`Skipping page ${page.id} during sync:`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	return { pages: pageCount, snapshots: snapshotCount };
}

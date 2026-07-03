import { Client } from "@notionhq/client";
import { hasRichText } from "./sync.js";

// Thrown when the live block's type has no rich_text field to overwrite
// (divider, image, child_page, table, ...) — the same set of types
// extractBlockText (sync.ts) already treats as "no text" on the read side,
// decided here via the same hasRichText guard rather than a second hardcoded
// list that could drift from it.
export class UnsupportedBlockTypeError extends Error {
	constructor(public readonly blockType: string) {
		super(`Block type '${blockType}' does not support text content; cannot write back.`);
		this.name = "UnsupportedBlockTypeError";
	}
}

export type WriteBlockContentInput = {
	accessToken: string;
	blockId: string;
	content: string;
};

// Write `content` into the live Notion block. Two-step (retrieve, then update)
// because blocks.update requires the body nested under the block's own type key
// (e.g. { paragraph: { rich_text } }) and the block's Notion type is not stored
// anywhere in Concord's DB — it can also legitimately change between the sync
// that captured the content and the resolve that writes it back. The token is
// never logged, per this repo's standing rule.
//
// MVP limitation: the kept content is written as a single plain-text run,
// discarding any per-segment formatting (bold/italic/links/mentions/colors) the
// block had — Conflict.user1Content/user2Content are already plain strings
// (extractBlockText joins plain_text), so the fidelity was lost at capture time;
// this is just where it becomes visible in the real workspace. Sibling fields
// inside the same type object (to_do.checked, code.language, callout.icon, ...)
// are left out of the update body so Notion's partial-update semantics keep them.
export async function writeBlockContent({
	accessToken,
	blockId,
	content,
}: WriteBlockContentInput): Promise<void> {
	const notion = new Client({ auth: accessToken });

	const block = await notion.blocks.retrieve({ block_id: blockId });
	if (!("type" in block)) {
		// PartialBlockObjectResponse: no type key, so there is no way to know what
		// shape blocks.update expects. Treated as an upstream failure by the caller.
		throw new Error(
			`Notion returned a partial block for ${blockId}; cannot determine how to write content.`,
		);
	}

	const typeSpecific = (block as unknown as Record<string, unknown>)[block.type];
	if (!hasRichText(typeSpecific)) {
		throw new UnsupportedBlockTypeError(block.type);
	}

	await notion.blocks.update({
		block_id: blockId,
		[block.type]: {
			rich_text: [{ type: "text" as const, text: { content } }],
		},
		// Same targeted-cast escape hatch as sync.ts's block[block.type] read: the
		// SDK's update parameter is a discriminated union that TS can't index with a
		// runtime-computed type key.
	} as Parameters<typeof notion.blocks.update>[0]);
}

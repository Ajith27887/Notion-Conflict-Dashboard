import { Client, isFullBlock } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_SECRET_TOKEN });

export async function GET() {
	try {
		const listUserResponse = await notion.users.list({});
		console.log(listUserResponse, "list");

		return listUserResponse

	} catch (error) {
		console.log(error, "Error");
	}
}

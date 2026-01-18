import Image from "next/image";
import { Client, isFullPage } from "@notionhq/client";


export default function Home() {

const notion = new Client({ auth: process.env.NOTION_SECRET_TOKEN });

(async () => {
  const Response = await notion.search({
	filter: { property :'object', value: "page" }
  })
//   console.log(Response.results, "list" );
})();

(
	async () => {
		try {
        const page = await notion.pages.retrieve({
            page_id: "2c5efd7a-a986-8094-8e91-ee26d916cb8a"
        });
        console.log(page, "Home");
    } catch (error) {
        console.log("Error retrieving page:" );
    }
		
	}
)();


  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
		<h1>HI</h1>
    </div>
  );
}

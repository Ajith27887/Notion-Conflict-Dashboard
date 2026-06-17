import { Client } from '@notionhq/client';
import type { PageObjectResponse, DataSourceObjectResponse } from '@notionhq/client/build/src/api-endpoints';


export default function Home() {

const notion = new Client({ auth: process.env.NOTION_SECRET_TOKEN });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
		<h1>HI</h1>
    </div>
  );
}

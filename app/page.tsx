import { Client } from '@notionhq/client';
import type { PageObjectResponse, DataSourceObjectResponse } from '@notionhq/client/build/src/api-endpoints';


export default function Home() {

const notion = new Client({ auth: process.env.NOTION_SECRET_TOKEN });

// (async () => {
//   // This returns ONLY pages/databases connected to your integration
//   const botInfo = await notion.users.me();
  
  
// 	console.log('Integration Details:');
//   console.log('Bot ID:', botInfo.id);
//   console.log('Bot Name:', botInfo.name);
//   console.log('Type:', botInfo.type); // Should be "bot"
  
// })();


async function checkIntegrationConnections() {
  try {
    console.log('🔍 Checking Integration Connections...\n');
    
    // Get bot information
    const bot = await notion.users.me();
    console.log(`Integration Name: ${bot.name}`);
    console.log(`Bot ID: ${bot.id}`);
    console.log(`Bot Type: ${bot.type}\n`);
    
    // Search for all connected pages and databases
    const response = await notion.search({});
    
    console.log(`📊 Total Connected Items: ${response.results.length}\n`);
    
    // Categorize the results
    const stats = {
      totalPages: 0,
      totalDataSources: 0,
      workspacePages: [] as PageObjectResponse[],
      workspaceDatabases: [] as DataSourceObjectResponse[],
      childPages: [] as PageObjectResponse[],
      childDatabases: [] as DataSourceObjectResponse[]
    };
    
    response.results.forEach((item) => {
      if (item.object === 'page') {
        stats.totalPages++;
        if ('parent' in item) {
          const page = item as PageObjectResponse;
          if (page.parent.type === 'workspace') {
            stats.workspacePages.push(page);
          } else {
            stats.childPages.push(page);
          }
        }
      }
      
      if (item.object === 'data_source') {
        stats.totalDataSources++;
        if ('parent' in item) {
          const db = item as DataSourceObjectResponse;
          if (db.parent.type === 'workspace') {
            stats.workspaceDatabases.push(db);
          } else {
            stats.childDatabases.push(db);
          }
        }
      }
    });
    
    // Display summary
    console.log('═══════════════════════════════════════');
    console.log('📄 PAGES:');
    console.log('═══════════════════════════════════════');
    console.log(`   Total Pages: ${stats.totalPages}`);
    console.log(`   ├─ Workspace-level: ${stats.workspacePages.length}`);
    console.log(`   └─ Child pages: ${stats.childPages.length}\n`);
    
    console.log('═══════════════════════════════════════');
    console.log('🗄️  DATABASES (Data Sources):');
    console.log('═══════════════════════════════════════');
    console.log(`   Total Databases: ${stats.totalDataSources}`);
    console.log(`   ├─ Workspace-level: ${stats.workspaceDatabases.length}`);
    console.log(`   └─ Child databases: ${stats.childDatabases.length}\n`);
    
    // List workspace pages
    if (stats.workspacePages.length > 0) {
      console.log('📄 Workspace Pages:');
      stats.workspacePages.forEach((page, index) => {
        const titleProp = page.properties.title;
        const title = titleProp?.type === 'title' 
          ? titleProp.title[0]?.plain_text || 'Untitled'
          : 'Untitled';
        console.log(`   ${index + 1}. ${title}`);
        console.log(`      ID: ${page.id}`);
      });
      console.log();
    }
	
    
    // List workspace databases
    if (stats.workspaceDatabases.length > 0) {
      console.log('🗄️  Workspace Databases:');
      stats.workspaceDatabases.forEach((db, index) => {
        const title = db.title[0]?.plain_text || 'Untitled';
        console.log(`   ${index + 1}. ${title}`);
        console.log(`      ID: ${db.id}`);
      });
      console.log();
    }
    
    return stats;
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'unauthorized') {
      console.error('Make sure your API key is correct and has the necessary permissions.');
    }

    throw error;
  }
}

// Run the function
checkIntegrationConnections()
  .then((stats) => {
    console.log('✅ Connection check complete!');
  })
  .catch((error) => {
    console.error('Failed to check connections:', error);
  });


  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
		<h1>HI</h1>
    </div>
  );
}

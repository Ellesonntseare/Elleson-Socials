export async function selectedFacebookPage(env,workspaceId){
 const saved=await env.DB.prepare("SELECT a.id FROM page_preferences p JOIN social_accounts a ON a.id = p.account_id AND a.workspace_id = p.workspace_id AND a.provider = 'facebook' WHERE p.workspace_id = ?").bind(workspaceId).first();
 if(saved)return saved.id;
 const pages=await env.DB.prepare("SELECT id FROM social_accounts WHERE workspace_id = ? AND provider = 'facebook' LIMIT 2").bind(workspaceId).all();
 return pages.results.length===1?pages.results[0].id:null;
}

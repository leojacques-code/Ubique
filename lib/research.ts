export interface SearchResult { title:string; url:string; content:string; score?:number; }

export async function fetchPublicPage(url?: string) {
  if (!url) return '';
  try {
    const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0 Ubique/1.0'}, cache:'no-store' });
    if (!res.ok) return '';
    const html = await res.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,30000);
  } catch { return ''; }
}

export async function searchWeb(query:string): Promise<SearchResult[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  const res = await fetch('https://api.tavily.com/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query,search_depth:'advanced',max_results:8,include_answer:false}), cache:'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r:any) => ({title:r.title,url:r.url,content:r.content,score:r.score}));
}

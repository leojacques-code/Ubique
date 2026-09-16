import { isIP } from 'node:net';

export interface SearchResult { title:string; url:string; content:string; score?:number; }

function isPrivateIpv4(host:string) {
  const parts=host.split('.').map(Number);
  if(parts.length!==4||parts.some(n=>Number.isNaN(n)||n<0||n>255))return false;
  const [a,b]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}

function isSafePublicUrl(value:string) {
  try {
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false;
    const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host==='metadata.google.internal')return false;
    const ip=isIP(host);
    if(ip===4&&isPrivateIpv4(host))return false;
    if(ip===6&&(host==='::1'||host.startsWith('fc')||host.startsWith('fd')||host.startsWith('fe8')||host.startsWith('fe9')||host.startsWith('fea')||host.startsWith('feb')))return false;
    return true;
  } catch { return false; }
}

export async function fetchPublicPage(url?: string) {
  if (!url || !isSafePublicUrl(url)) return '';
  try {
    const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0 Ubique/1.0'}, cache:'no-store', redirect:'follow' });
    if (!res.ok) return '';
    const finalUrl=res.url||url;
    if(!isSafePublicUrl(finalUrl))return '';
    const type=res.headers.get('content-type')||'';
    if(type&&!type.includes('text/html')&&!type.includes('text/plain'))return '';
    const html = await res.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,30000);
  } catch { return ''; }
}

export async function searchWeb(query:string): Promise<SearchResult[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  const res = await fetch('https://api.tavily.com/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query,search_depth:'advanced',max_results:8,include_answer:false}), cache:'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).filter((r:any)=>isSafePublicUrl(String(r.url||''))).map((r:any) => ({title:r.title,url:r.url,content:r.content,score:r.score}));
}

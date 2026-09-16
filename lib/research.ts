import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SearchResult { title:string; url:string; content:string; score?:number; }

function isPrivateIpv4(host:string) {
  const parts=host.split('.').map(Number);
  if(parts.length!==4||parts.some(n=>Number.isNaN(n)||n<0||n>255))return false;
  const [a,b,c]=parts;
  return a===0||a===10||a===127||a>=224||
    (a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||
    (a===198&&(b===18||b===19))||(a===192&&b===0&&c===0);
}

function isPrivateIpv6(host:string){
  const h=host.toLowerCase();
  if(h==='::'||h==='::1'||h.startsWith('fc')||h.startsWith('fd'))return true;
  if(/^fe[89ab]/.test(h))return true;
  if(h.startsWith('::ffff:')){
    const mapped=h.slice('::ffff:'.length);
    if(isIP(mapped)===4)return isPrivateIpv4(mapped);
  }
  return false;
}

function isSafePublicUrl(value:string) {
  try {
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false;
    const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
    if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host==='metadata.google.internal')return false;
    const ip=isIP(host);
    if(ip===4&&isPrivateIpv4(host))return false;
    if(ip===6&&isPrivateIpv6(host))return false;
    return true;
  } catch { return false; }
}

async function resolvesOnlyToPublicAddresses(value:string){
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
    const direct=isIP(host);
    if(direct===4)return !isPrivateIpv4(host);
    if(direct===6)return !isPrivateIpv6(host);
    const answers=await lookup(host,{all:true,verbatim:true});
    return answers.length>0&&answers.every(({address})=>{
      const version=isIP(address);
      return version===4?!isPrivateIpv4(address):version===6?!isPrivateIpv6(address):false;
    });
  }catch{return false;}
}

export async function fetchPublicPage(url?: string) {
  if (!url || !isSafePublicUrl(url) || !(await resolvesOnlyToPublicAddresses(url))) return '';
  try {
    let current=url;
    for(let redirects=0;redirects<=4;redirects++){
      if(!isSafePublicUrl(current)||!(await resolvesOnlyToPublicAddresses(current)))return '';
      const res = await fetch(current, {
        headers:{'User-Agent':'Mozilla/5.0 Ubique/1.0','Accept':'text/html,text/plain;q=0.9,*/*;q=0.1'},
        cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15_000)
      });
      if(res.status>=300&&res.status<400){
        const location=res.headers.get('location');
        if(!location||redirects===4)return '';
        current=new URL(location,current).toString();
        continue;
      }
      if (!res.ok) return '';
      const type=res.headers.get('content-type')||'';
      if(type&&!type.includes('text/html')&&!type.includes('text/plain'))return '';
      const declaredSize=Number(res.headers.get('content-length')||0);
      if(declaredSize>2_000_000)return '';
      const html = await res.text();
      if(html.length>2_000_000)return '';
      return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,30000);
    }
    return '';
  } catch { return ''; }
}

export async function searchWeb(query:string): Promise<SearchResult[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  const safeQuery=query.trim().slice(0,800);
  if(!safeQuery)return [];
  try{
    const res = await fetch('https://api.tavily.com/search', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query:safeQuery,search_depth:'advanced',max_results:8,include_answer:false}),
      cache:'no-store',signal:AbortSignal.timeout(20_000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).filter((r:any)=>isSafePublicUrl(String(r.url||''))).map((r:any) => ({title:r.title,url:r.url,content:r.content,score:r.score}));
  }catch{return [];}
}

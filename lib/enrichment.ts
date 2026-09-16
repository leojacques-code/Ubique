import crypto from 'crypto';
import { Application, Contact } from './types';
import { aiJson, fastModel } from './openai';
import { searchWeb, SearchResult } from './research';

const CONTACT_TYPES = new Set<Contact['type']>(['Recruteur','RH / Talent','Manager','Analyst / Associate','Alumni','Autre']);
const RELEVANCE = new Set<NonNullable<Contact['relevance']>>(['Principale','Secondaire','Réseau']);

function dedupeResults(results:SearchResult[], max=24){
  const map=new Map<string,SearchResult>();
  for(const hit of results){
    const url=String(hit.url||'').trim();
    if(!url||map.has(url))continue;
    map.set(url,{...hit,url});
    if(map.size>=max)break;
  }
  return [...map.values()];
}

function compactHit(hit:SearchResult){
  return {title:String(hit.title||'').slice(0,300),url:hit.url,content:String(hit.content||'').slice(0,3500)};
}

function sourceContains(source:SearchResult|undefined,value?:string){
  if(!source||!value)return false;
  const haystack=`${source.title}\n${source.url}\n${source.content}`.toLowerCase();
  return haystack.includes(value.toLowerCase());
}

export interface EnrichmentResult {
  sourceUrls:string[];
  contacts:Contact[];
  researchSummary:string;
  occurrences:SearchResult[];
}

export async function enrichApplicationResearch(app:Application):Promise<EnrichmentResult>{
  if(!process.env.TAVILY_API_KEY)throw new Error('TAVILY_API_KEY is required for cross-platform research.');
  const company=app.company.trim();
  const job=app.jobTitle.trim();
  const occurrenceQueries=[
    `"${company}" "${job}" careers`,
    `"${company}" "${job}" LinkedIn jobs`,
    `"${company}" "${job}" Welcome to the Jungle`,
    `"${company}" "${job}" eFinancialCareers`,
    `"${company}" "${job}" JobTeaser`,
    `"${company}" "${job}" Indeed Glassdoor`
  ];
  const contactQueries=[
    `"${company}" recruiter talent acquisition ${job}`,
    `"${company}" ${app.vertical.join(' ')} analyst associate team LinkedIn`,
    `"${company}" careers recruitment email team`,
    `"${company}" SKEMA alumni LinkedIn`
  ];

  const [occurrenceBatches,contactBatches]=await Promise.all([
    Promise.all(occurrenceQueries.map(searchWeb)),
    Promise.all(contactQueries.map(searchWeb))
  ]);
  const occurrences=dedupeResults(occurrenceBatches.flat(),24);
  const contactHits=dedupeResults(contactBatches.flat(),24);
  const sourceUrls=[...new Set([app.officialUrl,...occurrences.map(x=>x.url)].filter(Boolean) as string[])];

  const researchSummary=occurrences.slice(0,12).map(hit=>`${hit.title}\n${hit.url}\n${String(hit.content||'').slice(0,900)}`).join('\n\n');
  if(!process.env.OPENAI_API_KEY||!contactHits.length)return {sourceUrls,contacts:[],researchSummary,occurrences};

  const extraction=await aiJson<{contacts:{name:string;role:string;type?:string;linkedin?:string;email?:string;source:string;relevance?:string;whyUseful?:string}[]}>(
    `Extract only useful recruiting/networking contacts for this finance application from the supplied search evidence. Zero invention. A contact must have a named person and a role supported by a source. Never infer or synthesize an email pattern. Return an email only when the exact address is visibly present in that same source evidence. Return a LinkedIn URL only when the URL itself is present in evidence. Prefer, in order: role-linked recruiter, Talent/HR, probable hiring manager, team members close to the role, Analyst/Associate, VP/Director/Principal, senior leadership only if genuinely relevant, SKEMA alumni. Return JSON {contacts:[{name,role,type,linkedin,email,source,relevance,whyUseful}]}. type must be one of Recruteur, RH / Talent, Manager, Analyst / Associate, Alumni, Autre. relevance must be Principale, Secondaire or Réseau.`,
    JSON.stringify({application:{company:app.company,jobTitle:app.jobTitle,vertical:app.vertical},sources:contactHits.map(compactHit)}),
    {model:fastModel(),maxOutputTokens:2400}
  );

  const contacts:Contact[]=[];
  for(const raw of extraction.contacts||[]){
    const name=String(raw.name||'').trim();
    const role=String(raw.role||'').trim();
    const sourceUrl=String(raw.source||'').trim();
    const source=contactHits.find(hit=>hit.url===sourceUrl);
    if(!name||!role||!source)continue;
    const rawEmail=String(raw.email||'').trim();
    const email=rawEmail&&sourceContains(source,rawEmail)?rawEmail:undefined;
    const rawLinkedin=String(raw.linkedin||'').trim();
    const linkedin=rawLinkedin&&/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\//i.test(rawLinkedin)&&sourceContains(source,rawLinkedin)?rawLinkedin:undefined;
    const type=CONTACT_TYPES.has(raw.type as Contact['type'])?raw.type as Contact['type']:'Autre';
    const relevance=RELEVANCE.has(raw.relevance as NonNullable<Contact['relevance']>)?raw.relevance as NonNullable<Contact['relevance']>:'Réseau';
    contacts.push({
      id:crypto.randomUUID(),company:app.company,name,role,type,linkedin,email,
      emailStatus:email?'Public vérifié':'Non trouvé',
      alumniSkema:type==='Alumni',source:source.url,relevance,
      notes:String(raw.whyUseful||'').trim().slice(0,500)||undefined
    });
  }

  const unique=new Map<string,Contact>();
  for(const contact of contacts){
    const key=`${contact.name}|${contact.role}|${contact.email||contact.linkedin||contact.source}`.toLowerCase();
    if(!unique.has(key))unique.set(key,contact);
  }
  return {sourceUrls,contacts:[...unique.values()].slice(0,12),researchSummary,occurrences};
}

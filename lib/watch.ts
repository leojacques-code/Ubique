import crypto from 'crypto';
import { aiJson, fastModel } from './openai';
import { searchWeb } from './research';
import { listApplications, saveApplication } from './store';
import { Application } from './types';
import { coreRules } from './prompts';
import { dateInTimeZone } from './dates';

const queries = [
  'Private Equity Investment Analyst Intern Paris January 2027',
  'Private Credit Analyst Intern Paris 2027',
  'M&A Analyst Intern Paris January 2027',
  'Investment Banking Off Cycle Paris 2027',
  'Hedge Fund Equity Research Intern Paris 2027',
  'Corporate Development Intern Paris January 2027'
];
const allowedVerticals = new Set(['Private Equity','Hedge Fund / Public Markets','Private Credit','M&A / IB','Corporate Development','Transaction Services','Asset Management','Venture Capital']);

function fingerprint(company:string,title:string) { return `${company}|${title}`.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,''); }

export async function runWatch() {
  if (!process.env.TAVILY_API_KEY || !process.env.OPENAI_API_KEY) return {found:0,added:0,note:'TAVILY_API_KEY and OPENAI_API_KEY are required for automated discovery.'};
  if (!process.env.GOOGLE_REFRESH_TOKEN) return {found:0,added:0,note:'GOOGLE_REFRESH_TOKEN is required to persist unattended watch results.'};
  const hits = (await Promise.all(queries.map(searchWeb))).flat().slice(0,30);
  if(!hits.length)return {found:0,added:0,note:'No public search results returned.'};
  const candidates = await aiJson<{jobs:{company:string;jobTitle:string;location?:string;url:string;source?:string;startDate?:string;vertical:string[];priority:'A'|'B'|'C';reason:string}[]}>(`${coreRules}\nFrom search results, keep only genuinely relevant finance opportunities compatible with Paris / January 2027 or near-term graduate hiring. Prefer the employer Careers/ATS URL over job-board duplicates whenever the search evidence contains it. Deduplicate aggressively. Return JSON {jobs:[...]}.`, JSON.stringify(hits), {model:fastModel(),maxOutputTokens:2500});
  const apps = await listApplications(true);
  const known = new Set(apps.map(a => fingerprint(a.company,a.jobTitle)));
  let added=0;
  for (const job of candidates.jobs || []) {
    const company=String(job.company||'').trim();
    const jobTitle=String(job.jobTitle||'').trim();
    const url=String(job.url||'').trim();
    if(!company||!jobTitle||!url)continue;
    if (known.has(fingerprint(company,jobTitle))) continue;
    const vertical=(job.vertical||[]).filter(v=>allowedVerticals.has(v));
    const now = new Date().toISOString();
    const app:Application = { id:crypto.randomUUID(),company,jobTitle,location:job.location,officialUrl:url,sourceUrls:[url],startDate:job.startDate,vertical,priority:job.priority || 'B',careerPriority:job.priority || 'B',status:'Inbox',stage:'Candidature',nextAction:'Analyser et vérifier la source officielle',nextActionDate:dateInTimeZone(),createdAt:now,updatedAt:now };
    await saveApplication(app,true);
    known.add(fingerprint(company,jobTitle));
    added++;
  }
  return {found:candidates.jobs?.length || 0,added};
}

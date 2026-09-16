import crypto from 'crypto';
import { aiJson } from './openai';
import { searchWeb } from './research';
import { listApplications, saveApplication } from './store';
import { Application } from './types';
import { coreRules } from './prompts';

const queries = [
  'Private Equity Investment Analyst Intern Paris January 2027',
  'Private Credit Analyst Intern Paris 2027',
  'M&A Analyst Intern Paris January 2027',
  'Investment Banking Off Cycle Paris 2027',
  'Hedge Fund Equity Research Intern Paris 2027',
  'Corporate Development Intern Paris January 2027'
];

function fingerprint(company:string,title:string) { return `${company}|${title}`.toLowerCase().replace(/[^a-z0-9]+/g,''); }

export async function runWatch() {
  if (!process.env.TAVILY_API_KEY || !process.env.OPENAI_API_KEY) return {found:0,added:0,note:'TAVILY_API_KEY and OPENAI_API_KEY are required for automated discovery.'};
  const hits = (await Promise.all(queries.map(searchWeb))).flat().slice(0,30);
  const candidates = await aiJson<{jobs:{company:string;jobTitle:string;location?:string;url:string;source?:string;startDate?:string;vertical:string[];priority:'A'|'B'|'C';reason:string}[]}>(`${coreRules}\nFrom search results, keep only genuinely relevant finance opportunities compatible with Paris / January 2027 or near-term graduate hiring. Deduplicate aggressively. Return JSON {jobs:[...]}.`, JSON.stringify(hits));
  const apps = await listApplications(true);
  const known = new Set(apps.map(a => fingerprint(a.company,a.jobTitle)));
  let added=0;
  for (const job of candidates.jobs || []) {
    if (known.has(fingerprint(job.company,job.jobTitle))) continue;
    const now = new Date().toISOString();
    const app:Application = { id:crypto.randomUUID(),company:job.company,jobTitle:job.jobTitle,location:job.location,officialUrl:job.url,sourceUrls:[job.url],startDate:job.startDate,vertical:job.vertical || [],priority:job.priority || 'B',careerPriority:job.priority || 'B',status:'Inbox',stage:'Candidature',nextAction:'Analyser et vérifier la source officielle',nextActionDate:now.slice(0,10),createdAt:now,updatedAt:now };
    await saveApplication(app,true);
    known.add(fingerprint(job.company,job.jobTitle));
    added++;
  }
  return {found:candidates.jobs?.length || 0,added};
}

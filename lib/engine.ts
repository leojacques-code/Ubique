import { Application, PreparationResult } from './types';
import { aiJson, aiText } from './openai';
import { coverLetterPrompt, emailPrompt, jobAnalysisPrompt, linkedinPrompt, matchingPrompt, emailClassifierPrompt } from './prompts';
import { fetchPublicPage, searchWeb } from './research';
import { gmailSearch } from './google';

export async function prepareApplication(app: Application): Promise<PreparationResult> {
  const jobSnapshot = app.jobSnapshot || await fetchPublicPage(app.officialUrl);
  if (!jobSnapshot) throw new Error('Add the job description or a readable official URL before preparing.');
  const jobAnalysis = await aiJson<PreparationResult['jobAnalysis']>(jobAnalysisPrompt, jobSnapshot);
  const companyHits = await searchWeb(`${app.company} ${app.jobTitle} careers team deals investment strategy`);
  const companyResearch = companyHits.length ? companyHits.map(r => `${r.title}\n${r.url}\n${r.content}`).join('\n\n') : 'No external search provider configured. Use only the supplied job description and verified user data.';
  let gmailHistory = 'No Gmail history available.';
  try {
    const mails = await gmailSearch(`(${app.company}) -from:jobalerts-noreply@linkedin.com`);
    gmailHistory = mails.slice(0,8).map(m => `${m.date} | ${m.subject} | ${m.from} | ${m.snippet}`).join('\n') || 'No prior email found.';
  } catch {}
  const match = await aiJson<{evidenceMap:PreparationResult['evidenceMap'];strengths:string[];gaps:string[];recommendedCv:string}>(matchingPrompt, JSON.stringify({job:jobAnalysis,jobSnapshot,companyResearch,gmailHistory}));
  const context = JSON.stringify({application:app,jobAnalysis,evidenceMap:match.evidenceMap,strengths:match.strengths,gaps:match.gaps,companyResearch,gmailHistory});
  const [coverLetter, applicationEmail, linkedinMessage] = await Promise.all([
    aiText(coverLetterPrompt, context),
    aiText(emailPrompt, context),
    aiText(linkedinPrompt, context)
  ]);
  return { jobSnapshot, jobAnalysis, evidenceMap:match.evidenceMap, strengths:match.strengths, gaps:match.gaps, companyResearch, recommendedCv:match.recommendedCv, coverLetter, applicationEmail, linkedinMessage, nextAction:'Relire les livrables puis candidater via le canal officiel.' };
}

export async function classifyApplicationEmail(app: Application, mail: {subject:string;from:string;snippet:string}) {
  return aiJson<{classification:string;confidence:number;actionRequired:boolean;detectedStage?:string;suggestedStatus?:string;suggestedAction:string;summary:string}>(emailClassifierPrompt, JSON.stringify({application:{company:app.company,jobTitle:app.jobTitle,reference:app.reference},mail}));
}

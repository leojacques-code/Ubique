import crypto from 'crypto';
import { gmailSearch, addGmailLabel } from './google';
import { listApplications, listInteractions, saveApplication, saveInteractions } from './store';
import { classifyApplicationEmail } from './engine';
import { Interaction, ApplicationStatus, ApplicationStage } from './types';

function mapLabel(status?:string) {
  if (status === 'Refus') return 'Candidatures/Refus';
  if (status === 'Offre') return 'Candidatures/Offre';
  if (status === 'En process') return 'Candidatures/En process';
  if (status === 'Relance') return 'Candidatures/Relance';
  return 'Candidatures/Envoyée';
}

export async function runGmailSync() {
  const apps = (await listApplications(true)).filter(a => !['Clôturée','Refus'].includes(a.status));
  const existing = await listInteractions(true);
  const processed = new Set(existing.map(i => i.gmailMessageId).filter(Boolean));
  const newInteractions:Interaction[] = [];
  let changed = 0;
  for (const app of apps) {
    const query = `newer_than:3d (${app.company}) -from:jobalerts-noreply@linkedin.com`;
    let mails:any[] = [];
    try { mails = await gmailSearch(query,true); } catch { continue; }
    for (const mail of mails) {
      if (processed.has(mail.id)) continue;
      const decision = await classifyApplicationEmail(app,mail);
      const interaction:Interaction = { id:crypto.randomUUID(),applicationId:app.id,type:decision.classification,date:new Date().toISOString(),channel:'Gmail',gmailMessageId:mail.id,subject:mail.subject,summary:decision.summary,aiClassification:decision.classification,confidence:decision.confidence };
      newInteractions.push(interaction);
      processed.add(mail.id);
      if (decision.confidence >= 0.86 && decision.suggestedStatus) {
        const allowed:ApplicationStatus[] = ['Envoyée','Relance','En process','Offre','Refus'];
        if (allowed.includes(decision.suggestedStatus as ApplicationStatus)) {
          app.status = decision.suggestedStatus as ApplicationStatus;
          if (decision.detectedStage) app.stage = decision.detectedStage as ApplicationStage;
          app.lastInteraction = new Date().toISOString().slice(0,10);
          app.nextAction = decision.suggestedAction;
          await saveApplication(app,true);
          try { await addGmailLabel(mail.id,mapLabel(app.status),true); } catch {}
          changed++;
        }
      }
    }
  }
  await saveInteractions(newInteractions,true);
  return {processed:newInteractions.length,changed};
}

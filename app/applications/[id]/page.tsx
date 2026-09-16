import { notFound } from 'next/navigation';
import { getApplication, listContacts } from '@/lib/store';
import { ApplicationActions } from '@/components/ApplicationActions';
import { Contact } from '@/lib/types';

function mergeContacts(existing:Contact[],global:Contact[]){
  const key=(c:Contact)=>`${c.company}|${c.email||c.linkedin||c.name}|${c.role}`.toLowerCase();
  const map=new Map<string,Contact>();
  for(const c of [...existing,...global])map.set(key(c),{...map.get(key(c)),...c});
  return [...map.values()];
}
function sourceLabel(url:string){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return 'source';}}

export default async function ApplicationPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const app=await getApplication(id);
  if(!app)notFound();
  const globalContacts=await listContacts();
  const companyContacts=mergeContacts(app.contacts||[],globalContacts.filter(c=>c.company.toLowerCase()===app.company.toLowerCase()));
  const hasEmail=!!companyContacts.find(c=>c.email);
  const sourceUrls=[...new Set([app.officialUrl,...(app.sourceUrls||[])].filter(Boolean) as string[])];
  return <div className="page">
    <section className="application-hero">
      <div className="row"><span className={`priority p-${app.priority.toLowerCase()}`}>{app.priority}</span><span className="badge">{app.status}</span><span className="badge">{app.stage}</span>{app.fitScore&&<span className="badge">Fit {app.fitScore}/10</span>}</div>
      <h1>{app.company}</h1><p>{app.jobTitle} · {app.location||'Localisation à confirmer'} · {app.contractType||'Contrat à confirmer'}</p>
      <ApplicationActions id={app.id} hasEmail={hasEmail}/>
    </section>
    <div className="grid two-col">
      <div className="section-stack">
        <section className="panel"><h2>Pourquoi ça matche</h2>{(app.strengths||[]).map(x=><p key={x}>✓ {x}</p>)}<h2 style={{marginTop:22}}>Vigilances</h2>{(app.gaps||[]).map(x=><p key={x} className="muted">• {x}</p>)}</section>
        <section className="panel"><h2>Evidence Engine</h2>{app.evidenceMap?.length?app.evidenceMap.map((e,i)=><div className="evidence" key={i}><strong>{e.requirement}</strong><span>{e.evidence}<br/><small className="muted">{e.source}</small></span><span className="badge">{e.evidenceType}</span></div>):<p className="muted">Lance « Préparer la candidature » pour générer le mapping des preuves.</p>}</section>
        {app.coverLetter&&<section className="panel"><h2>Lettre de motivation</h2><div className="doc-box">{app.coverLetter}</div></section>}
        {app.applicationEmail&&<section className="panel"><h2>Email</h2><div className="doc-box">{app.applicationEmail}</div></section>}
        {app.linkedinMessage&&<section className="panel"><h2>LinkedIn</h2><div className="doc-box">{app.linkedinMessage}</div></section>}
      </div>
      <aside className="section-stack">
        <section className="panel"><h2>Prochaine action</h2><strong>{app.nextAction||'À définir'}</strong><p className="muted">{app.nextActionDate||''}</p></section>
        <section className="panel"><h2>Contacts</h2>{companyContacts.length?companyContacts.slice(0,6).map(c=><p key={`${c.id}-${c.email||c.linkedin||c.name}`}><strong>{c.name}</strong><br/><span className="muted">{c.role} · {c.emailStatus}</span>{c.email&&<><br/><span className="muted">{c.email}</span></>}{c.linkedin&&<><br/><a className="muted" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></>}</p>):<p className="muted">Aucun contact en base.</p>}</section>
        <section className="panel"><h2>Documents</h2><p>CV · {app.cvVersion||'À sélectionner'}</p><p>LM · {app.coverLetterReady?'Prête':'À préparer'}</p><p>Email · {app.emailReady?'Prêt':'À préparer'}</p><p>LinkedIn · {app.linkedinReady?'Prêt':'À préparer'}</p></section>
        <section className="panel"><h2>Sources</h2>{sourceUrls.length?<div className="source-list">{sourceUrls.slice(0,10).map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer" className={i===0&&url===app.officialUrl?'button':'source-link'}>{i===0&&url===app.officialUrl?'Offre officielle':sourceLabel(url)} ↗</a>)}</div>:<p className="muted">Aucune source publique enregistrée.</p>}</section>
        {app.companyResearch&&<section className="panel"><h2>Recherche entreprise</h2><div className="doc-box">{app.companyResearch}</div></section>}
      </aside>
    </div>
  </div>;
}

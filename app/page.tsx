import Link from 'next/link';
import { listApplications } from '@/lib/store';
import { dateInTimeZone } from '@/lib/dates';

export default async function Dashboard() {
  const apps = await listApplications();
  const count=(s:string)=>apps.filter(a=>a.status===s).length;
  const today=dateInTimeZone();
  const due=apps.filter(a=>a.nextActionDate && a.nextActionDate<=today && !['Clôturée','Refus'].includes(a.status)).sort((a,b)=>(a.nextActionDate||'').localeCompare(b.nextActionDate||''));
  const active=apps.filter(a=>a.status==='En process');
  return <div className="page">
    <div className="page-head"><div><h1>Dashboard</h1><p>Ce qui demande ton attention, sans bruit.</p></div><Link className="button primary" href="/opportunities">+ Ajouter une offre</Link></div>
    <div className="grid stats">
      <div className="stat"><div className="number">{count('À préparer')+count('Prête à envoyer')}</div><small>À préparer / envoyer</small></div>
      <div className="stat"><div className="number">{count('Envoyée')}</div><small>En attente</small></div>
      <div className="stat"><div className="number">{count('Relance')}</div><small>Relances</small></div>
      <div className="stat"><div className="number">{count('En process')}</div><small>Process actifs</small></div>
    </div>
    <div className="grid two-col">
      <section className="panel"><h2>Aujourd’hui</h2><div className="list">{due.length?due.slice(0,8).map(a=><Link href={`/applications/${a.id}`} className="list-item" key={a.id}><div><strong>{a.company}</strong><p>{a.jobTitle} · {a.nextAction}</p></div><span className={`priority p-${a.priority.toLowerCase()}`}>{a.priority}</span></Link>):<div className="muted">Aucune action urgente.</div>}</div></section>
      <section className="panel"><h2>Process actifs</h2><div className="list">{active.length?active.map(a=><Link href={`/applications/${a.id}`} className="list-item" key={a.id}><div><strong>{a.company}</strong><p>{a.stage} · {a.nextAction}</p></div><span className="badge">{a.stage}</span></Link>):<div className="muted">Aucun process actif.</div>}</div></section>
    </div>
  </div>;
}

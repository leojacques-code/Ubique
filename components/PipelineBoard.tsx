'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Application, APPLICATION_STATUSES, ApplicationStatus } from '@/lib/types';

export function PipelineBoard({initial}:{initial:Application[]}) {
  const [apps,setApps] = useState(initial);
  const move = async (id:string,status:ApplicationStatus) => {
    setApps(x => x.map(a => a.id===id?{...a,status}:a));
    await fetch(`/api/applications/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}).catch(()=>null);
  };
  return <div className="board">{APPLICATION_STATUSES.map(status => <section className="column" key={status}>
    <div className="column-title"><span>{status}</span><span>{apps.filter(a=>a.status===status).length}</span></div>
    {apps.filter(a=>a.status===status).map(app => <article className="kanban-card" key={app.id}>
      <div className="row between"><span className={`priority p-${app.priority.toLowerCase()}`}>{app.priority}</span><span className="score">{app.fitScore ? `${app.fitScore}/10` : '—'}</span></div>
      <Link href={`/applications/${app.id}`}><h3>{app.company}</h3><p>{app.jobTitle}</p></Link>
      <div className="tags">{app.vertical.slice(0,2).map(v=><span key={v}>{v}</span>)}</div>
      <small>{app.nextAction || 'Aucune action'}</small>
      <select value={app.status} onChange={e=>move(app.id,e.target.value as ApplicationStatus)} aria-label="Changer le statut">{APPLICATION_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
    </article>)}
  </section>)}</div>
}

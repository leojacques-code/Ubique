import Link from 'next/link';
import { listApplications } from '@/lib/store';
import { OpportunityCapture } from '@/components/OpportunityCapture';

const priorityRank={A:0,B:1,C:2} as const;
const closed=new Set(['Refus','Clôturée']);

export default async function Opportunities(){
  const apps=(await listApplications()).sort((a,b)=>{
    const state=(closed.has(a.status)?1:0)-(closed.has(b.status)?1:0);
    if(state)return state;
    const priority=priorityRank[a.priority]-priorityRank[b.priority];
    if(priority)return priority;
    return (a.nextActionDate||'9999-12-31').localeCompare(b.nextActionDate||'9999-12-31')||a.company.localeCompare(b.company,'fr');
  });
  return <div className="page"><div className="page-head"><div><h1>Opportunités</h1><p>Offres détectées, analysées et dédupliquées.</p></div><OpportunityCapture/></div><div className="table-wrap"><table className="table"><thead><tr><th>Priorité</th><th>Société</th><th>Poste</th><th>Verticale</th><th>Fit</th><th>Statut</th><th>Prochaine action</th></tr></thead><tbody>{apps.map(a=><tr key={a.id}><td><span className={`priority p-${a.priority.toLowerCase()}`}>{a.priority}</span></td><td><Link href={`/applications/${a.id}`}><strong>{a.company}</strong></Link></td><td>{a.jobTitle}</td><td>{a.vertical.join(', ')}</td><td>{a.fitScore!==undefined?a.fitScore:'—'}</td><td><span className="badge">{a.status}</span></td><td>{a.nextAction}</td></tr>)}</tbody></table></div></div>;
}

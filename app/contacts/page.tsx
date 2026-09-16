import { listContacts } from '@/lib/store';

const relevanceRank={Principale:0,Secondaire:1,Réseau:2} as const;

export default async function Contacts(){
  const contacts=(await listContacts()).sort((a,b)=>{
    const ar=a.relevance?relevanceRank[a.relevance]:3;
    const br=b.relevance?relevanceRank[b.relevance]:3;
    return ar-br||a.company.localeCompare(b.company,'fr')||a.name.localeCompare(b.name,'fr');
  });
  return <div className="page"><div className="page-head"><div><h1>Contacts</h1><p>Un contact principal, éventuellement un secondaire. Pas de spam.</p></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Priorité</th><th>Nom</th><th>Société</th><th>Fonction</th><th>Type</th><th>Email</th><th>Qualité</th><th>LinkedIn</th><th>Pourquoi</th><th>Source</th></tr></thead><tbody>{contacts.map(c=><tr key={c.id}><td>{c.relevance?<span className="badge">{c.relevance}</span>:'—'}</td><td><strong>{c.name}</strong>{c.alumniSkema&&<><br/><span className="muted">SKEMA</span></>}</td><td>{c.company}</td><td>{c.role}</td><td>{c.type}</td><td>{c.email||'—'}</td><td><span className="badge">{c.emailStatus}</span></td><td>{c.linkedin?<a href={c.linkedin} target="_blank" rel="noreferrer">Ouvrir ↗</a>:'—'}</td><td>{c.notes||'—'}</td><td>{c.source?<a href={c.source} target="_blank" rel="noreferrer">Source ↗</a>:'—'}</td></tr>)}</tbody></table></div></div>;
}

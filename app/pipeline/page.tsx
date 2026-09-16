import { listApplications } from '@/lib/store';
import { PipelineBoard } from '@/components/PipelineBoard';
export default async function Pipeline(){const apps=await listApplications();return <div className="page"><div className="page-head"><div><h1>Pipeline</h1><p>De la découverte à l’offre, une seule source de vérité.</p></div></div><PipelineBoard initial={apps}/></div>}

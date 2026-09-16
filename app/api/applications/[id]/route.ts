import { NextRequest, NextResponse } from 'next/server';
import { getApplication, saveApplication } from '@/lib/store';
import { APPLICATION_STAGES, APPLICATION_STATUSES } from '@/lib/types';
import { isOwnerRequest } from '@/lib/authz';

const PATCHABLE = new Set(['status','stage','priority','nextAction','nextActionDate','reference','location','contractType','officialUrl','sourceUrls','publicationDate','startDate','deadline','channel','cvVersion','salaryMin','salaryMax','salaryCurrency']);

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    if(!(await isOwnerRequest()))return NextResponse.json({error:'Connexion propriétaire requise.'},{status:401});
    const {id}=await params;
    const app=await getApplication(id);
    if(!app)return NextResponse.json({error:'Not found'},{status:404});
    const raw=await req.json();
    const patch=Object.fromEntries(Object.entries(raw).filter(([key])=>PATCHABLE.has(key)));
    if('status' in patch&&!APPLICATION_STATUSES.includes(patch.status as any))return NextResponse.json({error:'Statut invalide.'},{status:400});
    if('stage' in patch&&!APPLICATION_STAGES.includes(patch.stage as any))return NextResponse.json({error:'Étape invalide.'},{status:400});
    if('priority' in patch&&!['A','B','C'].includes(String(patch.priority)))return NextResponse.json({error:'Priorité invalide.'},{status:400});
    if(typeof patch.officialUrl==='string'&&patch.officialUrl){try{const u=new URL(patch.officialUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return NextResponse.json({error:'URL officielle invalide.'},{status:400});}}
    Object.assign(app,patch,{updatedAt:new Date().toISOString()});
    await saveApplication(app);
    return NextResponse.json(app);
  }catch(e:any){return NextResponse.json({error:e.message},{status:400});}
}

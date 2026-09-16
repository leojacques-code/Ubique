import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listApplications, saveApplication } from '@/lib/store';
import { Application, Priority } from '@/lib/types';
import { isOwnerRequest } from '@/lib/authz';

const PRIORITIES = new Set<Priority>(['A','B','C']);
const VERTICALS = new Set(['Private Equity','Hedge Fund / Public Markets','Private Credit','M&A / IB','Corporate Development','Transaction Services','Asset Management','Venture Capital']);

function canonicalUrl(value?:string){
  if(!value)return '';
  try{
    const u=new URL(value);
    for(const key of [...u.searchParams.keys()])if(key.toLowerCase().startsWith('utm_'))u.searchParams.delete(key);
    u.hash='';
    u.pathname=u.pathname.replace(/\/+$/,'')||'/';
    u.searchParams.sort();
    return u.toString();
  }catch{return '';}
}

function sameText(a?:string,b?:string){
  return !!a&&!!b&&a.trim().toLocaleLowerCase('fr')===b.trim().toLocaleLowerCase('fr');
}

export async function GET(){
  return NextResponse.json(await listApplications());
}

export async function POST(req:NextRequest){
  try{
    if(!(await isOwnerRequest()))return NextResponse.json({error:'Connexion propriétaire requise.'},{status:401});
    const body=await req.json();
    const company=String(body.company||'').trim();
    const jobTitle=String(body.jobTitle||'').trim();
    if(!company||!jobTitle)return NextResponse.json({error:'Société et poste sont obligatoires.'},{status:400});
    const priority:Priority=PRIORITIES.has(body.priority)?body.priority:'B';
    const vertical=(Array.isArray(body.vertical)?body.vertical:[]).filter((v:unknown)=>typeof v==='string'&&VERTICALS.has(v));
    const officialUrl=String(body.officialUrl||'').trim();
    if(officialUrl){try{const u=new URL(officialUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return NextResponse.json({error:'URL officielle invalide.'},{status:400});}}
    const reference=String(body.reference||'').trim();

    const existing=await listApplications();
    const canonical=canonicalUrl(officialUrl);
    const duplicate=existing.find(app=>{
      const urls=[app.officialUrl,...(app.sourceUrls||[])].map(canonicalUrl).filter(Boolean);
      if(canonical&&urls.includes(canonical))return true;
      if(reference&&sameText(app.company,company)&&sameText(app.reference,reference))return true;
      return false;
    });
    if(duplicate){
      return NextResponse.json({
        error:'Cette offre semble déjà enregistrée.',
        duplicateId:duplicate.id,
        duplicateCompany:duplicate.company,
        duplicateJobTitle:duplicate.jobTitle,
        duplicateStatus:duplicate.status
      },{status:409});
    }

    const now=new Date().toISOString();
    const app:Application={
      id:crypto.randomUUID(),company,jobTitle,reference:reference||undefined,officialUrl:officialUrl||undefined,
      jobSnapshot:String(body.jobSnapshot||'').trim()||undefined,
      location:String(body.location||'').trim()||undefined,
      contractType:String(body.contractType||'').trim()||undefined,
      startDate:String(body.startDate||'').trim()||undefined,
      deadline:String(body.deadline||'').trim()||undefined,
      channel:String(body.channel||'').trim()||undefined,
      vertical,priority,careerPriority:priority,status:'Inbox',stage:'Candidature',
      nextAction:'Analyser et vérifier la source officielle',nextActionDate:now.slice(0,10),createdAt:now,updatedAt:now
    };
    await saveApplication(app);
    return NextResponse.json(app,{status:201});
  }catch(e:any){return NextResponse.json({error:e.message},{status:400});}
}

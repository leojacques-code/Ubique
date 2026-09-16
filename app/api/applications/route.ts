import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listApplications, saveApplication } from '@/lib/store';
import { Application, Priority } from '@/lib/types';
import { isOwnerRequest } from '@/lib/authz';
import { dateInTimeZone } from '@/lib/dates';

const PRIORITIES = new Set<Priority>(['A','B','C']);
const VERTICALS = new Set(['Private Equity','Hedge Fund / Public Markets','Private Credit','M&A / IB','Corporate Development','Transaction Services','Asset Management','Venture Capital']);
const LIMITS={company:180,jobTitle:260,location:180,reference:140,url:2500,snapshot:80000};

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

function tooLong(value:string,max:number){return value.length>max;}

export async function GET(){
  return NextResponse.json(await listApplications());
}

export async function POST(req:NextRequest){
  try{
    if(!(await isOwnerRequest()))return NextResponse.json({error:'Connexion propriétaire requise.'},{status:401});
    const body=await req.json();
    const company=String(body.company||'').trim();
    const jobTitle=String(body.jobTitle||'').trim();
    const officialUrl=String(body.officialUrl||'').trim();
    const reference=String(body.reference||'').trim();
    const location=String(body.location||'').trim();
    const jobSnapshot=String(body.jobSnapshot||'').trim();
    if(!company||!jobTitle)return NextResponse.json({error:'Société et poste sont obligatoires.'},{status:400});
    if(tooLong(company,LIMITS.company)||tooLong(jobTitle,LIMITS.jobTitle)||tooLong(location,LIMITS.location)||tooLong(reference,LIMITS.reference)||tooLong(officialUrl,LIMITS.url))return NextResponse.json({error:'Un des champs de l’offre dépasse la longueur autorisée.'},{status:400});
    if(tooLong(jobSnapshot,LIMITS.snapshot))return NextResponse.json({error:'La description de l’offre est trop longue. Conserve la fiche de poste utile sous 80 000 caractères.'},{status:413});
    const priority:Priority=PRIORITIES.has(body.priority)?body.priority:'B';
    const vertical=(Array.isArray(body.vertical)?body.vertical:[]).filter((v:unknown)=>typeof v==='string'&&VERTICALS.has(v));
    if(officialUrl){try{const u=new URL(officialUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return NextResponse.json({error:'URL officielle invalide.'},{status:400});}}

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
      jobSnapshot:jobSnapshot||undefined,
      location:location||undefined,
      contractType:String(body.contractType||'').trim().slice(0,120)||undefined,
      startDate:String(body.startDate||'').trim().slice(0,40)||undefined,
      deadline:String(body.deadline||'').trim().slice(0,40)||undefined,
      channel:String(body.channel||'').trim().slice(0,120)||undefined,
      vertical,priority,careerPriority:priority,status:'Inbox',stage:'Candidature',
      nextAction:'Analyser et vérifier la source officielle',nextActionDate:dateInTimeZone(),createdAt:now,updatedAt:now
    };
    await saveApplication(app);
    return NextResponse.json(app,{status:201});
  }catch(e:any){return NextResponse.json({error:e.message},{status:400});}
}

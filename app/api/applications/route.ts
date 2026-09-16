import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listApplications, saveApplication } from '@/lib/store';
import { Application, Priority } from '@/lib/types';

const PRIORITIES = new Set<Priority>(['A','B','C']);
const VERTICALS = new Set(['Private Equity','Hedge Fund / Public Markets','Private Credit','M&A / IB','Corporate Development','Transaction Services','Asset Management','Venture Capital']);

export async function GET(){
  return NextResponse.json(await listApplications());
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const company=String(body.company||'').trim();
    const jobTitle=String(body.jobTitle||'').trim();
    if(!company||!jobTitle)return NextResponse.json({error:'Société et poste sont obligatoires.'},{status:400});
    const priority:Priority=PRIORITIES.has(body.priority)?body.priority:'B';
    const vertical=(Array.isArray(body.vertical)?body.vertical:[]).filter((v:unknown)=>typeof v==='string'&&VERTICALS.has(v));
    const officialUrl=String(body.officialUrl||'').trim();
    if(officialUrl){try{const u=new URL(officialUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return NextResponse.json({error:'URL officielle invalide.'},{status:400});}}
    const now=new Date().toISOString();
    const app:Application={
      id:crypto.randomUUID(),company,jobTitle,officialUrl:officialUrl||undefined,
      jobSnapshot:String(body.jobSnapshot||'').trim()||undefined,
      location:String(body.location||'').trim()||undefined,
      vertical,priority,careerPriority:priority,status:'Inbox',stage:'Candidature',
      nextAction:'Analyser et vérifier la source officielle',nextActionDate:now.slice(0,10),createdAt:now,updatedAt:now
    };
    await saveApplication(app);
    return NextResponse.json(app,{status:201});
  }catch(e:any){return NextResponse.json({error:e.message},{status:400});}
}

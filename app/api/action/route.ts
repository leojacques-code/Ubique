import { NextRequest, NextResponse } from 'next/server';
import { getApplication, listContacts, saveApplication, saveContacts } from '@/lib/store';
import { prepareApplication } from '@/lib/engine';
import { createGmailDraft } from '@/lib/google';
import { isOwnerRequest } from '@/lib/authz';
import { enrichApplicationResearch } from '@/lib/enrichment';
import { Contact } from '@/lib/types';

function mergeContacts(existing:Contact[],incoming:Contact[]){
  const key=(c:Contact)=>`${c.company}|${c.email||c.linkedin||c.name}|${c.role}`.toLowerCase();
  const map=new Map(existing.map(c=>[key(c),c]));
  for(const contact of incoming)map.set(key(contact),{...map.get(key(contact)),...contact});
  return [...map.values()];
}

export async function POST(req:NextRequest){
  try{
    if(!(await isOwnerRequest()))return NextResponse.json({error:'Connexion propriétaire requise.'},{status:401});
    const {action,applicationId}=await req.json();
    const app=await getApplication(applicationId);
    if(!app)return NextResponse.json({error:'Candidature introuvable'},{status:404});

    if(action==='enrich'){
      const result=await enrichApplicationResearch(app);
      app.sourceUrls=[...new Set([...(app.sourceUrls||[]),...result.sourceUrls])];
      app.contacts=mergeContacts(app.contacts||[],result.contacts);
      if(result.researchSummary)app.companyResearch=result.researchSummary;
      app.updatedAt=new Date().toISOString();
      await saveApplication(app);
      await saveContacts(result.contacts);
      return NextResponse.json({message:`Recherche terminée : ${result.sourceUrls.length} source(s), ${result.contacts.length} nouveau(x) contact(s) vérifié(s).`,result});
    }

    if(action==='prepare'){
      const result=await prepareApplication(app);
      Object.assign(app,{...result,coverLetterReady:true,emailReady:true,linkedinReady:true,cvVersion:result.recommendedCv,status:'Prête à envoyer',updatedAt:new Date().toISOString()});
      await saveApplication(app);
      return NextResponse.json({message:'Candidature préparée',result});
    }

    if(action==='draft'){
      const globalContacts=await listContacts();
      const candidates=[...(app.contacts||[]),...globalContacts.filter(c=>c.company.toLowerCase()===app.company.toLowerCase())]
        .filter((c,i,arr)=>c.email&&arr.findIndex(x=>x.id===c.id)===i)
        .sort((a,b)=>{
          const relevance={Principale:0,Secondaire:1,Réseau:2} as Record<string,number>;
          const emailQuality={'Public vérifié':0,'Probable':1,'Non trouvé':2} as Record<string,number>;
          return (relevance[a.relevance||'Réseau']??3)-(relevance[b.relevance||'Réseau']??3) || (emailQuality[a.emailStatus]??3)-(emailQuality[b.emailStatus]??3);
        });
      const contact=candidates[0];
      if(!contact?.email)return NextResponse.json({error:'Aucun email public ou probable n’est rattaché à cette société.'},{status:400});
      if(!app.applicationEmail)return NextResponse.json({error:'Génère d’abord les livrables.'},{status:400});
      const lines=app.applicationEmail.split('\n');
      const subjectLine=lines.find(x=>x.startsWith('SUBJECT:'));
      const subject=subjectLine?.replace('SUBJECT:','').trim()||`Candidature - ${app.jobTitle} - Léo CHETY`;
      const body=lines.filter(x=>x!==subjectLine).join('\n').trim();
      await createGmailDraft(contact.email,subject,body);
      return NextResponse.json({message:`Brouillon créé dans Gmail pour ${contact.name}. Aucun envoi automatique.`});
    }

    if(action==='mark-sent'){
      app.status='Envoyée';
      app.applicationDate=new Date().toISOString().slice(0,10);
      const d=new Date();d.setDate(d.getDate()+7);
      app.nextAction='Relancer si aucun retour et si le contexte le justifie';
      app.nextActionDate=d.toISOString().slice(0,10);
      await saveApplication(app);
      return NextResponse.json({message:'Candidature marquée comme envoyée.'});
    }

    return NextResponse.json({error:'Action inconnue'},{status:400});
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:500});
  }
}

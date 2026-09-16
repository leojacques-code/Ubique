import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req:NextRequest){
  const clientId=process.env.GOOGLE_CLIENT_ID?.trim();
  const appUrl=process.env.APP_URL?.trim();
  const configuredRedirect=process.env.GOOGLE_REDIRECT_URI?.trim();
  if(!clientId)return NextResponse.json({error:'GOOGLE_CLIENT_ID non configuré'},{status:400});
  if(process.env.NODE_ENV==='production'&&!process.env.ALLOWED_GOOGLE_EMAIL?.trim())return NextResponse.json({error:'ALLOWED_GOOGLE_EMAIL non configuré'},{status:503});
  if(process.env.NODE_ENV==='production'&&!process.env.APP_SESSION_SECRET?.trim())return NextResponse.json({error:'APP_SESSION_SECRET non configuré'},{status:503});
  const redirect=configuredRedirect||(appUrl?`${appUrl.replace(/\/$/,'')}/api/auth/google/callback`:`${req.nextUrl.origin}/api/auth/google/callback`);
  try{new URL(redirect);}catch{return NextResponse.json({error:'GOOGLE_REDIRECT_URI / APP_URL invalide'},{status:500});}

  const state=crypto.randomBytes(24).toString('hex');
  const scopes=[
    'openid','email','profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'
  ];
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',clientId);
  url.searchParams.set('redirect_uri',redirect);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',scopes.join(' '));
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('state',state);
  const res=NextResponse.redirect(url);
  res.cookies.set('ubique_oauth_state',state,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:600,path:'/'});
  return res;
}

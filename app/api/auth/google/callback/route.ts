import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, sessionCookieName } from '@/lib/session';

export async function GET(req:NextRequest){
  const code=req.nextUrl.searchParams.get('code');
  const state=req.nextUrl.searchParams.get('state');
  const saved=req.cookies.get('ubique_oauth_state')?.value;
  if(!code||!state||state!==saved)return NextResponse.json({error:'Invalid OAuth state'},{status:400});

  const allowed=process.env.ALLOWED_GOOGLE_EMAIL?.trim().toLowerCase();
  if(process.env.NODE_ENV==='production'&&!allowed)return NextResponse.json({error:'ALLOWED_GOOGLE_EMAIL must be configured in production.'},{status:503});

  const redirect=process.env.GOOGLE_REDIRECT_URI||`${process.env.APP_URL||req.nextUrl.origin}/api/auth/google/callback`;
  const body=new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID||'',
    client_secret:process.env.GOOGLE_CLIENT_SECRET||'',
    code,
    grant_type:'authorization_code',
    redirect_uri:redirect
  });
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});
  if(!tokenRes.ok)return NextResponse.json({error:'Google token exchange failed'},{status:400});
  const tokens=await tokenRes.json();
  if(!tokens.access_token)return NextResponse.json({error:'Google did not return an access token'},{status:400});

  const userRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:'no-store'});
  if(!userRes.ok)return NextResponse.json({error:'Google user lookup failed'},{status:400});
  const user=await userRes.json();
  const email=String(user.email||'').trim().toLowerCase();
  if(!email)return NextResponse.json({error:'Google account has no usable email'},{status:400});
  if(allowed&&email!==allowed)return NextResponse.json({error:'Google account not allowed'},{status:403});

  const res=NextResponse.redirect(new URL('/settings',process.env.APP_URL||req.nextUrl.origin));
  res.cookies.set(sessionCookieName,encodeSession({email,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+(tokens.expires_in||3600)*1000}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*30,path:'/'});
  res.cookies.delete('ubique_oauth_state');
  return res;
}

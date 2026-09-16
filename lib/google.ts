import { getSession } from './session';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const tokenCache = new Map<string,{accessToken:string;expiresAt:number}>();

async function refreshAccessToken(refreshToken: string) {
  const cached=tokenCache.get(refreshToken);
  if(cached&&cached.expiresAt>Date.now()+60_000)return cached.accessToken;
  const clientId=process.env.GOOGLE_CLIENT_ID||'';
  const clientSecret=process.env.GOOGLE_CLIENT_SECRET||'';
  if(!clientId||!clientSecret)throw new Error('Google OAuth client credentials are not configured');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch(GOOGLE_TOKEN_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body, cache:'no-store', signal:AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data=await res.json() as {access_token?:string;expires_in?:number};
  if(!data.access_token)throw new Error('Google token refresh returned no access token');
  tokenCache.set(refreshToken,{accessToken:data.access_token,expiresAt:Date.now()+(data.expires_in||3600)*1000});
  return data.access_token;
}

export async function getGoogleAccessToken(background = false): Promise<string | null> {
  if (!background) {
    const session = await getSession();
    if (session?.accessToken && session.expiresAt > Date.now() + 60_000) return session.accessToken;
    if (session?.refreshToken) return refreshAccessToken(session.refreshToken);
  }
  if (process.env.GOOGLE_REFRESH_TOKEN) return refreshAccessToken(process.env.GOOGLE_REFRESH_TOKEN);
  return null;
}

export async function googleFetch<T>(url: string, init: RequestInit = {}, background = false): Promise<T> {
  const token = await getGoogleAccessToken(background);
  if (!token) throw new Error('Google not connected');
  const res = await fetch(url, { ...init, cache:'no-store', signal:init.signal||AbortSignal.timeout(25_000), headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json', ...(init.headers || {}) } });
  if (!res.ok) {
    const detail=(await res.text()).slice(0,600);
    throw new Error(`Google API ${res.status}${detail?`: ${detail}`:''}`);
  }
  return res.json() as Promise<T>;
}

export async function gmailSearch(query: string, background = false) {
  const list = await googleFetch<{messages?:{id:string;threadId:string}[]}>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`, {}, background);
  if (!list.messages?.length) return [];
  return Promise.all(list.messages.map(async ({id}) => {
    const msg = await googleFetch<any>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, {}, background);
    const headers = Object.fromEntries((msg.payload?.headers || []).map((h:{name:string;value:string}) => [h.name.toLowerCase(), h.value]));
    return { id, threadId:msg.threadId, subject:headers.subject || '', from:headers.from || '', to:headers.to || '', date:headers.date || '', snippet:msg.snippet || '', labelIds:msg.labelIds || [] };
  }));
}

function encodeHeader(value:string){
  return `=?UTF-8?B?${Buffer.from(value,'utf8').toString('base64')}?=`;
}

export async function createGmailDraft(to: string, subject: string, body: string) {
  const raw = Buffer.from([`To: ${to}`,`Subject: ${encodeHeader(subject)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: 8bit','',body].join('\r\n')).toString('base64url');
  return googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method:'POST', body:JSON.stringify({message:{raw}}) });
}

export async function addGmailLabel(messageId: string, labelName: string, background = false) {
  const labels = await googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/labels', {}, background);
  let label = (labels.labels || []).find((l:any) => l.name === labelName);
  if (!label) label = await googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/labels', { method:'POST', body:JSON.stringify({name:labelName,labelListVisibility:'labelShow',messageListVisibility:'show'}) }, background);
  await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, { method:'POST', body:JSON.stringify({addLabelIds:[label.id]}) }, background);
}

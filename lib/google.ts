import { getSession } from './session';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch(GOOGLE_TOKEN_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return res.json() as Promise<{access_token:string; expires_in:number}>;
}

export async function getGoogleAccessToken(background = false): Promise<string | null> {
  if (!background) {
    const session = await getSession();
    if (session?.accessToken && session.expiresAt > Date.now() + 60_000) return session.accessToken;
    if (session?.refreshToken) return (await refreshAccessToken(session.refreshToken)).access_token;
  }
  if (process.env.GOOGLE_REFRESH_TOKEN) return (await refreshAccessToken(process.env.GOOGLE_REFRESH_TOKEN)).access_token;
  return null;
}

export async function googleFetch<T>(url: string, init: RequestInit = {}, background = false): Promise<T> {
  const token = await getGoogleAccessToken(background);
  if (!token) throw new Error('Google not connected');
  const res = await fetch(url, { ...init, headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
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

export async function createGmailDraft(to: string, subject: string, body: string) {
  const raw = Buffer.from([`To: ${to}`,`Subject: ${subject}`,'Content-Type: text/plain; charset="UTF-8"','',body].join('\r\n')).toString('base64url');
  return googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method:'POST', body:JSON.stringify({message:{raw}}) });
}

export async function addGmailLabel(messageId: string, labelName: string, background = false) {
  const labels = await googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/labels', {}, background);
  let label = (labels.labels || []).find((l:any) => l.name === labelName);
  if (!label) label = await googleFetch<any>('https://gmail.googleapis.com/gmail/v1/users/me/labels', { method:'POST', body:JSON.stringify({name:labelName,labelListVisibility:'labelShow',messageListVisibility:'show'}) }, background);
  await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, { method:'POST', body:JSON.stringify({addLabelIds:[label.id]}) }, background);
}

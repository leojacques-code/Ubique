import { Application, Contact, Interaction } from './types';
import { demoApplications, demoContacts } from './demo-data';
import { getGoogleAccessToken, googleFetch } from './google';

const SHEET_NAME = 'Application CRM';
const TABS = ['Applications','Companies','Contacts','Interactions','Documents','JobSources','Profile','Evidence','Settings','SyncLog'];
let cachedSpreadsheetId: string | null = null;

async function ensureSpreadsheet(background = false) {
  if (process.env.GOOGLE_SPREADSHEET_ID) return process.env.GOOGLE_SPREADSHEET_ID;
  if (cachedSpreadsheetId) return cachedSpreadsheetId;
  const token = await getGoogleAccessToken(background);
  if (!token) return null;
  const q = encodeURIComponent(`name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const found = await googleFetch<any>(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`, {}, background);
  if (found.files?.[0]?.id) cachedSpreadsheetId = found.files[0].id;
  if (!cachedSpreadsheetId) {
    const created = await googleFetch<any>('https://sheets.googleapis.com/v4/spreadsheets', { method:'POST', body:JSON.stringify({properties:{title:SHEET_NAME},sheets:TABS.map(title => ({properties:{title}}))}) }, background);
    cachedSpreadsheetId = created.spreadsheetId;
  }
  return cachedSpreadsheetId;
}

async function readTab(tab: string, background = false): Promise<Record<string,string>[]> {
  const id = await ensureSpreadsheet(background);
  if (!id) return [];
  const data = await googleFetch<any>(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tab + '!A:AZ')}`, {}, background);
  const values:string[][] = data.values || [];
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => Object.fromEntries(headers.map((h,i) => [h,row[i] ?? ''])));
}

async function clearTab(tab:string,id:string,background=false) {
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tab + '!A:AZ')}:clear`, { method:'POST', body:'{}' }, background);
}

async function writeAll(tab: string, rows: Record<string,unknown>[], background = false) {
  const id = await ensureSpreadsheet(background);
  if (!id) throw new Error('Google Sheets is not connected');
  await clearTab(tab,id,background);
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const matrix = [keys, ...rows.map(r => keys.map(k => {
    const v = r[k];
    if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v);
    return v == null ? '' : String(v);
  }))];
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tab + '!A1')}?valueInputOption=RAW`, { method:'PUT', body:JSON.stringify({range:`${tab}!A1`,majorDimension:'ROWS',values:matrix}) }, background);
}

function parseApplication(row: Record<string,string>): Application {
  const jsonFields = new Set(['vertical','sourceUrls','gaps','strengths','contacts','evidenceMap']);
  const boolFields = new Set(['coverLetterReady','emailReady','linkedinReady','formReady']);
  const numFields = new Set(['fitScore','salaryMin','salaryMax']);
  const out:any = {...row};
  for (const k of jsonFields) if (row[k]) { try { out[k]=JSON.parse(row[k]); } catch { out[k]=[]; } }
  for (const k of boolFields) out[k] = row[k] === 'true';
  for (const k of numFields) if (row[k]) out[k] = Number(row[k]);
  return out as Application;
}

export async function listApplications(background = false): Promise<Application[]> {
  const token = await getGoogleAccessToken(background);
  if (!token) return demoApplications;
  const rows = await readTab('Applications', background);
  return rows.map(parseApplication);
}

export async function getApplication(id:string, background = false) {
  return (await listApplications(background)).find(a => a.id === id) || null;
}

export async function saveApplication(application: Application, background = false) {
  const token = await getGoogleAccessToken(background);
  if (!token) throw new Error('Google Sheets is not connected; demo mode is read-only.');
  const apps = await listApplications(background);
  const clean = apps.filter(a => a.id !== application.id);
  clean.push({...application,updatedAt:new Date().toISOString()});
  await writeAll('Applications', clean as unknown as Record<string,unknown>[], background);
  return application;
}

export async function listContacts(background = false): Promise<Contact[]> {
  const token = await getGoogleAccessToken(background);
  if (!token) return demoContacts;
  const rows = await readTab('Contacts', background);
  return rows.map(r => ({...r,alumniSkema:r.alumniSkema==='true'} as unknown as Contact));
}

export async function listInteractions(background = false): Promise<Interaction[]> {
  const token = await getGoogleAccessToken(background);
  if (!token) return [];
  return (await readTab('Interactions', background)) as unknown as Interaction[];
}

export async function saveInteractions(items: Interaction[], background = false) {
  if (!items.length) return;
  const existing = await listInteractions(background);
  const map = new Map(existing.map(x => [x.id,x]));
  items.forEach(x => map.set(x.id,x));
  await writeAll('Interactions', [...map.values()] as unknown as Record<string,unknown>[], background);
}

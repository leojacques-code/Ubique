import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface AppSession { email: string; accessToken: string; refreshToken?: string; expiresAt: number; }
const COOKIE = 'ubique_session';

function secret() { return process.env.APP_SESSION_SECRET || 'development-only-change-me'; }
function sign(payload: string) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }

export function encodeSession(session: AppSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function decodeSession(value?: string): AppSession | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AppSession; } catch { return null; }
}
export async function getSession() {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}
export const sessionCookieName = COOKIE;

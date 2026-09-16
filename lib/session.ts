import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface AppSession { email: string; accessToken: string; refreshToken?: string; expiresAt: number; }
const COOKIE = 'ubique_session';

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('APP_SESSION_SECRET is required in production');
  return value || 'development-only-change-me';
}

function key() { return crypto.createHash('sha256').update(secret()).digest(); }

export function encodeSession(session: AppSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(x => x.toString('base64url')).join('.');
}

export function decodeSession(value?: string): AppSession | null {
  if (!value) return null;
  try {
    const [ivB64, tagB64, encryptedB64] = value.split('.');
    if (!ivB64 || !tagB64 || !encryptedB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(decrypted) as AppSession;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}
export const sessionCookieName = COOKIE;

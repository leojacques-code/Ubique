import { cookies } from "next/headers";
import { decrypt, equal } from "./security";
import { refresh } from "./google";
export type Session = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionExpiresAt: number;
};
export class AuthError extends Error {}
export async function session() {
  try {
    const value = (await cookies()).get("crm_session")?.value;
    if (!value) return null;
    const s = decrypt<Session>(value);
    if (
      s.sessionExpiresAt < Date.now() ||
      s.email.toLowerCase() !== process.env.ALLOWED_EMAIL?.toLowerCase()
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
export async function requireSession() {
  const s = await session();
  if (!s) throw new AuthError("Connectez-vous avec votre compte autorisé.");
  return s;
}
export async function accessToken() {
  const s = await requireSession();
  return s.expiresAt > Date.now() + 60000
    ? s.accessToken
    : refresh(s.refreshToken);
}
export async function cronToken(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !equal(request.headers.get("authorization") || "", `Bearer ${secret}`)
  )
    throw new AuthError("Accès refusé");
  const sealed = process.env.GOOGLE_REFRESH_TOKEN_ENCRYPTED;
  if (!sealed)
    throw new Error("La connexion autonome du cron reste à configurer.");
  return refresh(decrypt<{ refreshToken: string }>(sealed).refreshToken);
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== process.env.APP_URL)
    throw new AuthError("Origine refusée");
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

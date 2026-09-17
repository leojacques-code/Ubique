import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encrypt, decrypt, equal } from "@/lib/security";
import { cookieOptions } from "@/lib/auth";
export async function GET(request: Request) {
  const jar = await cookies();
  try {
    const url = new URL(request.url);
    const sealed = jar.get("crm_oauth")?.value;
    jar.delete("crm_oauth");
    if (!sealed) throw new Error("Connexion expirée");
    const saved = decrypt<{ state: string; verifier: string; expires: number }>(
      sealed,
    );
    if (
      saved.expires < Date.now() ||
      !equal(saved.state, url.searchParams.get("state") || "")
    )
      throw new Error("État OAuth invalide");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Autorisation Google refusée");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || "",
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
    });
    if (!r.ok) throw new Error("Échange OAuth impossible");
    const tokens = await r.json();
    const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!u.ok) throw new Error("Identité Google non vérifiée");
    const user = await u.json();
    if (
      !user.email_verified ||
      user.email?.toLowerCase() !== process.env.ALLOWED_EMAIL?.toLowerCase()
    )
      throw new Error("Ce compte n’est pas autorisé");
    if (!tokens.refresh_token)
      throw new Error(
        "Autorisation hors ligne absente. Reconnectez Google avec consentement.",
      );
    jar.set(
      "crm_session",
      encrypt({
        email: user.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        sessionExpiresAt: Date.now() + 7 * 86400000,
      }),
      { ...cookieOptions, maxAge: 7 * 86400 },
    );
    return NextResponse.redirect(new URL("/", process.env.APP_URL));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connexion impossible" },
      { status: 401 },
    );
  }
}

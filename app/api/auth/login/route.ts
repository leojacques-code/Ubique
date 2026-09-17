import { oauthConfigured, ownerEmail } from "@/lib/config";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/security";
import { scopes } from "@/lib/google";
import { cookieOptions } from "@/lib/auth";
export async function GET(request: Request) {
  if (!oauthConfigured())
    return NextResponse.json(
      {
        error:
          "Configurez Google OAuth, APP_URL, ALLOWED_GOOGLE_EMAIL et APP_SESSION_SECRET.",
      },
      { status: 503 },
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  (await cookies()).set(
    "crm_oauth",
    encrypt({ state, verifier, expires: Date.now() + 600000 }),
    { ...cookieOptions, maxAge: 600 },
  );
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || "",
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      ...scopes,
      ...(new URL(request.url).searchParams.get("labels") === "1"
        ? ["https://www.googleapis.com/auth/gmail.modify"]
        : []),
    ].join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    login_hint: ownerEmail(),
  });
  return NextResponse.redirect(
    "https://accounts.google.com/o/oauth2/v2/auth?" + params,
  );
}

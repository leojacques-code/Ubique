/** Local bootstrap only. Writes encrypted credentials to .env.local, never logs tokens. */
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { encrypt, equal } from "../lib/security";
import { ownerEmail, sessionConfigured } from "../lib/config";
import { scopes } from "../lib/google";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])
    if (!process.env[key]) throw new Error(`Configurez ${key} dans .env.local`);
  if (!ownerEmail() || !sessionConfigured())
    throw new Error("Configurez ALLOWED_GOOGLE_EMAIL et APP_SESSION_SECRET");
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  const redirect = "http://localhost:3333/callback";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirect,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", redirect);
      if (
        url.pathname !== "/callback" ||
        !equal(url.searchParams.get("state") || "", state)
      )
        throw new Error("État OAuth invalide");
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Consentement refusé");
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirect,
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
      });
      if (!r.ok) throw new Error("Échange OAuth impossible");
      const tokens = await r.json();
      const u = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      const user = await u.json();
      if (
        !user.email_verified ||
        user.email.toLowerCase() !== ownerEmail().toLowerCase()
      )
        throw new Error("Compte non autorisé");
      if (!tokens.refresh_token) throw new Error("Refresh token absent");
      const sealed = encrypt({ refreshToken: tokens.refresh_token });
      let env = existsSync(".env.local")
        ? readFileSync(".env.local", "utf8")
        : "";
      env = env.replace(/^GOOGLE_REFRESH_TOKEN_ENCRYPTED=.*$/m, "");
      writeFileSync(
        ".env.local",
        env.trim() + "\nGOOGLE_REFRESH_TOKEN_ENCRYPTED=" + sealed + "\n",
        { mode: 0o600 },
      );
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        "Connexion enregistrée dans .env.local. Vous pouvez fermer cet onglet.",
      );
      console.log(
        "Jeton chiffré écrit dans .env.local. Ajoutez cette variable dans Vercel pour le cron.",
      );
      server.close();
    } catch (e) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(e instanceof Error ? e.message : "Erreur");
    }
  });
  server.listen(3333, "127.0.0.1", () => {
    console.log(
      "Ajoutez http://localhost:3333/callback aux URI Google autorisées.",
    );
    console.log(
      "Ouvrez ce lien dans votre navigateur :\nhttps://accounts.google.com/o/oauth2/v2/auth?" +
        params,
    );
  });
  setTimeout(() => server.close(), 10 * 60000).unref();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

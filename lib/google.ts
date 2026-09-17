export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
  ) {
    super(
      `${provider} indisponible (${status}). Vérifiez la connexion puis réessayez.`,
    );
  }
}
export async function google<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch("https://www.googleapis.com/" + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new ProviderError("Google", res.status);
  return res.status === 204 ? (undefined as T) : res.json();
}
export async function refresh(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok)
    throw new ProviderError(
      "Google OAuth : reconnexion nécessaire",
      res.status,
    );
  return (await res.json()).access_token as string;
}
export const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

import { cronToken, AuthError } from "@/lib/auth";
import { gmailSync } from "@/lib/services/gmailSyncService";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    return Response.json(await gmailSync(await cronToken(request)));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Échec de synchronisation" },
      { status: e instanceof AuthError ? 401 : 503 },
    );
  }
}

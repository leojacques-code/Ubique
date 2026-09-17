import { cronToken, AuthError } from "@/lib/auth";
import { watch } from "@/lib/services/jobService";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    return Response.json(await watch(await cronToken(request)));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Échec de synchronisation" },
      { status: e instanceof AuthError ? 401 : 503 },
    );
  }
}

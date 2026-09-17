import { cookies } from "next/headers";
import { checkOrigin, session } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const s = await session();
    if (s) {
      const r = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: s.refreshToken }),
      });
      if (!r.ok) throw new Error("Révocation Google impossible, réessayez.");
    }
    (await cookies()).delete("crm_session");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 400 },
    );
  }
}

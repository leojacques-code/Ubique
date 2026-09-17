import { accessToken, AuthError } from "@/lib/auth";
import { SheetsRepository } from "@/lib/repositories/store";
import type { Application } from "@/lib/types";
import { POST as action } from "@/app/api/action/route";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const app = await new SheetsRepository<Application>(
      await accessToken(),
      "Applications",
    ).findById((await params).id);
    return Response.json(app || { error: "Offre introuvable" }, {
      status: app ? 200 : 404,
    });
  } catch (e) {
    return Response.json(
      { error: "Accès impossible" },
      { status: e instanceof AuthError ? 401 : 400 },
    );
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const patch = await request.json();
  return action(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ action: "update", id: (await params).id, patch }),
    }),
  );
}

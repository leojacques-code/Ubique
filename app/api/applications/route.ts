import { accessToken, checkOrigin, AuthError } from "@/lib/auth";
import { SheetsRepository } from "@/lib/repositories/store";
import { addJob } from "@/lib/services/jobService";
import type { Application } from "@/lib/types";
import { z } from "zod";
const error = (e: unknown) =>
  Response.json(
    { error: e instanceof Error ? e.message : "Requête impossible" },
    { status: e instanceof AuthError ? 401 : 400 },
  );
export async function GET() {
  try {
    return Response.json(
      await new SheetsRepository<Application>(
        await accessToken(),
        "Applications",
      ).findAll(),
    );
  } catch (e) {
    return error(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = await accessToken();
    const raw = z
      .object({
        company: z.string().max(200).optional(),
        jobTitle: z.string().max(200).optional(),
        officialUrl: z.string().max(2000).optional(),
        url: z.string().max(2000).optional(),
        jobSnapshot: z.string().max(18000).optional(),
        description: z.string().max(18000).optional(),
      })
      .parse(await request.json());
    return Response.json(
      await addJob(token, {
        ...raw,
        url: raw.url || raw.officialUrl,
        description: raw.description || raw.jobSnapshot,
      }),
    );
  } catch (e) {
    return error(e);
  }
}

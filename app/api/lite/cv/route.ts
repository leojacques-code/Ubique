import { z } from "zod";
import { accessToken, checkOrigin, AuthError } from "@/lib/auth";
import { SheetsRepository, entity } from "@/lib/repositories/store";
import { uploadDrive } from "@/lib/services/documentService";
import { extractDocumentText } from "@/lib/services/textExtraction";
import type { Document } from "@/lib/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = await accessToken();
    const form = await request.formData();
    const file = form.get("file");
    const language = z.enum(["FR", "EN"]).parse(String(form.get("language") || "FR"));
    if (!(file instanceof File) || file.size > 4_000_000)
      throw new Error("CV PDF, DOCX ou TXT de moins de 4 Mo requis.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (await extractDocumentText(file.name, buffer)).slice(0, 30_000);
    if (text.length < 80) throw new Error("Le CV semble vide ou illisible.");

    const drive = await uploadDrive(
      token,
      file.name,
      buffer,
      file.type || "application/octet-stream",
      "CV",
    );
    const repo = new SheetsRepository<Document>(token, "Documents");
    const all = await repo.findAll();
    const version =
      1 +
      Math.max(
        0,
        ...all
          .filter((d) => d.type === "CV" && d.cvLanguage === language)
          .map((d) => d.version),
      );
    const doc = await repo.create({
      ...entity(),
      applicationId: "",
      type: "CV",
      filename: file.name,
      text,
      version,
      driveFileId: drive.id,
      driveUrl: drive.webViewLink,
      usedForApplication: false,
      quality: "CV source importé sans réécriture IA",
      mimeType: file.type || "application/octet-stream",
      cvLanguage: language,
    });
    return Response.json({ doc });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import du CV impossible" },
      { status: e instanceof AuthError ? 401 : 400 },
    );
  }
}

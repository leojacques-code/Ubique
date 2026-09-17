import { z } from "zod";
import { accessToken, checkOrigin, AuthError } from "@/lib/auth";
import { uploadDrive } from "@/lib/services/documentService";
import { extractPdfText } from "@/lib/services/pdfTextService";
import { SheetsRepository, entity } from "@/lib/repositories/store";
import type { Document } from "@/lib/types";
import { ai } from "@/lib/services/ai";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = await accessToken();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 4000000)
      throw new Error("PDF, DOCX ou TXT de moins de 4 Mo requis");
    const kind = String(form.get("kind") || "CV");
    const language = String(form.get("language") || "FR");
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (file.name.toLowerCase().endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else if (file.name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (file.name.endsWith(".txt")) text = buffer.toString("utf8");
    else throw new Error("Format non pris en charge");
    text = text.slice(0, 25000);
    const source = file.name;
    const schema = z.object({
      name: z.string(),
      evidence: z.array(
        z.object({
          category: z.enum([
            "Expérience",
            "Formation",
            "Compétence",
            "Langue",
            "Projet",
            "Intérêt",
          ]),
          fact: z.string(),
          type: z.enum([
            "DIRECT",
            "TRANSFERABLE",
            "ACADEMIC",
            "NOT_DEMONSTRATED",
          ]),
        }),
      ),
    });
    const parsed =
      kind === "CV"
        ? await ai(
            "Extrais intégralement le CV : toutes expériences, dates, missions, chiffres EXACTS, outils, langues, cursus, certifications, projets et intérêts. Ne réinterprète pas les pourcentages. Ne transforme pas un classement institutionnel en preuve. Un fait par preuve, formulation concise. Ne supprime aucune expérience.",
            { text, source },
            schema,
            { fast: true, maxOutputTokens: 4000 },
          )
        : null;
    const drive = await uploadDrive(
      token,
      file.name,
      buffer,
      file.type || "application/octet-stream",
      kind === "CV" ? "CV" : "Applications",
    );
    const repo = new SheetsRepository<Document>(token, "Documents");
    const all = await repo.findAll();
    const version =
      1 +
      Math.max(
        0,
        ...all
          .filter((d) => d.type === kind && d.cvLanguage === language)
          .map((d) => d.version),
      );
    const doc = await repo.create({
      ...entity(),
      applicationId: "",
      type: kind,
      filename: file.name,
      text,
      version,
      driveFileId: drive.id,
      driveUrl: drive.webViewLink,
      usedForApplication: false,
      quality: "Document importé",
      mimeType: file.type || "application/octet-stream",
      cvLanguage: language,
    });
    return Response.json({
      doc,
      text,
      profile: parsed
        ? {
            name: parsed.name,
            evidence: parsed.evidence.map((e) => ({
              ...e,
              id: crypto.randomUUID(),
              source,
            })),
          }
        : null,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import impossible" },
      { status: e instanceof AuthError ? 401 : 400 },
    );
  }
}

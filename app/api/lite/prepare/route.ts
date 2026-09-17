import { z } from "zod";
import { accessToken, checkOrigin, AuthError } from "@/lib/auth";
import { extract } from "@/lib/services/researchService";
import { extractDocumentText } from "@/lib/services/textExtraction";
import { prepareLiteApplication } from "@/lib/services/liteApplicationService";
import { safeUrl } from "@/lib/security";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = await accessToken();
    const form = await request.formData();
    const url = String(form.get("url") || "").trim();
    const description = String(form.get("description") || "").trim();
    const recipient = String(form.get("recipient") || "").trim();
    const cvPreference = z
      .enum(["AUTO", "FR", "EN"])
      .parse(String(form.get("cvPreference") || "AUTO"));
    const file = form.get("file");

    if (url && !safeUrl(url)) throw new Error("L'URL de l'offre doit être une URL HTTPS publique.");
    let fileText = "";
    if (file instanceof File && file.size) {
      if (file.size > 4_000_000) throw new Error("Le fichier de l'offre doit faire moins de 4 Mo.");
      fileText = await extractDocumentText(file.name, Buffer.from(await file.arrayBuffer()));
    }

    let offerText = [fileText, description].filter(Boolean).join("\n\n").trim();
    if (!offerText && url) offerText = await extract(url);
    if (!offerText)
      throw new Error("Collez l'URL, importez le PDF de l'offre ou ajoutez son descriptif.");

    return Response.json(
      await prepareLiteApplication(token, {
        url,
        offerText,
        cvPreference,
        recipient,
      }),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Préparation impossible" },
      { status: e instanceof AuthError ? 401 : 400 },
    );
  }
}

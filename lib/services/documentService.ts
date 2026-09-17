import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document as WordDocument, Packer, Paragraph, TextRun } from "docx";
import { google } from "../google";
import type { Document } from "../types";
export async function renderPdf(text: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const clean = text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\u0020-\u00FF\u20AC\n]/g, "");
  const width = 487;
  const lines: string[] = [];
  for (const para of clean.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, 10.5) > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  if (lines.length * 14 > 720)
    throw new Error(
      "La lettre dépasse une page A4. Raccourcissez le texte avant export.",
    );
  const page = pdf.addPage([595.28, 841.89]);
  lines.forEach((line, i) =>
    page.drawText(line, { x: 54, y: 785 - i * 14, font, size: 10.5 }),
  );
  return pdf.save();
}
export async function renderDocx(text: string) {
  return Packer.toBuffer(
    new WordDocument({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 900, bottom: 900, left: 1050, right: 1050 },
            },
          },
          children: text.split("\n").map(
            (line) =>
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: line, font: "Arial", size: 21 }),
                ],
              }),
          ),
        },
      ],
    }),
  );
}
export async function uploadDrive(
  token: string,
  name: string,
  bytes: Uint8Array,
  mime: string,
  folder = "Applications",
) {
  const root = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!root)
    throw new Error(
      "Configurez le dossier Drive. Le texte reste disponible dans le CRM.",
    );
  const children = await google<{ files: { id: string }[] }>(
    token,
    "drive/v3/files?q=" +
      encodeURIComponent(
        `trashed = false and '${root}' in parents and name = '${folder}'`,
      ),
  );
  const parent = children.files[0]?.id || root;
  const boundary = "crm_" + crypto.randomUUID();
  const metadata = JSON.stringify({ name, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok)
    throw new Error(`Drive indisponible (${r.status}). Le texte est conservé.`);
  return (await r.json()) as { id: string; webViewLink: string };
}
export async function exportDocument(
  token: string,
  doc: Document,
  format: "pdf" | "docx",
) {
  const bytes =
    format === "pdf" ? await renderPdf(doc.text) : await renderDocx(doc.text);
  const mime =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return uploadDrive(
    token,
    doc.filename + "." + format,
    bytes,
    mime,
    doc.type === "LM" ? "Letters" : "Applications",
  );
}
export async function downloadDrive(token: string, id: string) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok) throw new Error("Impossible de joindre le document Drive");
  return new Uint8Array(await r.arrayBuffer());
}

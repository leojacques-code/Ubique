import { extractPdfText } from "./pdfTextService";

export async function extractDocumentText(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return (await extractPdfText(buffer)).trim();
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }
  if (lower.endsWith(".txt")) return buffer.toString("utf8").trim();
  throw new Error("Format non pris en charge. Utilisez PDF, DOCX ou TXT.");
}

import { accessToken } from "@/lib/auth";
import { SheetsRepository } from "@/lib/repositories/store";
import type { Document } from "@/lib/types";
import { renderPdf, renderDocx } from "@/lib/services/documentService";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await accessToken();
    const doc = await new SheetsRepository<Document>(
      token,
      "Documents",
    ).findById((await params).id);
    if (!doc) throw new Error("Document introuvable");
    const format =
      new URL(request.url).searchParams.get("format") === "docx"
        ? "docx"
        : "pdf";
    const bytes =
      format === "pdf" ? await renderPdf(doc.text) : await renderDocx(doc.text);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${doc.filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}.${format}"`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Export impossible" },
      { status: 400 },
    );
  }
}

export async function extractPdfText(data: Uint8Array) {
  // pdf-parse/pdf.js needs a Node canvas factory on serverless runtimes such as
  // Vercel. Import the worker helpers first so DOMMatrix/Path2D are available
  // before pdf-parse evaluates its PDF.js dependency.
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data, CanvasFactory });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

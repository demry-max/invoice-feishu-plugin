/**
 * HTML → DOCX conversion (per spec req 2 — provide a Word-format invoice
 * link alongside the existing HTML and PDF links).
 *
 * We reuse the same rendered HTML so the Word document mirrors the PDF /
 * HTML output as closely as the converter allows. The `html-to-docx`
 * package is a pure-JS converter that maps inline styles + a subset of
 * CSS to OOXML.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HTMLtoDOCX: (
  html: string,
  headerHTMLString?: string | null,
  options?: Record<string, unknown>,
  footerHTMLString?: string | null,
) => Promise<Buffer | ArrayBuffer> = require("html-to-docx");

/**
 * Convert an invoice HTML string to a Word .docx file.
 * Returns a Node Buffer suitable for writing to disk or sending in a
 * response.
 */
export async function htmlToDocx(html: string): Promise<Buffer> {
  const result = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    header: false,
    pageNumber: false,
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
  });
  if (Buffer.isBuffer(result)) return result;
  return Buffer.from(result as ArrayBuffer);
}

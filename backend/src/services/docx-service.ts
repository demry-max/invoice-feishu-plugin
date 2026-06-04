/**
 * HTML → DOCX conversion (per spec req 2 — provide a Word-format invoice
 * link alongside the existing HTML and PDF links).
 *
 * v1 reused the full PDF/HTML template, which uses flexbox / absolute
 * positioning / heavy CSS — `html-to-docx` either ignored or mangled most
 * of it, producing awkward two-page splits and broken bank info blocks
 * (see screenshot 账单调整需求 2026-06-04). v2 uses a dedicated
 * DOCX-only template (`docx-template.ts`) built from table-based layout
 * with inline styles — the strict subset `html-to-docx` handles cleanly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HTMLtoDOCX: (
  html: string,
  headerHTMLString?: string | null,
  options?: Record<string, unknown>,
  footerHTMLString?: string | null,
) => Promise<Buffer | ArrayBuffer> = require("html-to-docx");

/**
 * Convert a (DOCX-friendly) HTML string to a Word .docx file.
 *
 * Returns a Node Buffer suitable for writing to disk or sending in a
 * response. Callers should pass HTML produced by
 * `renderInvoiceDocxHtml`, NOT the PDF/HTML template — the latter uses
 * CSS features `html-to-docx` cannot handle.
 *
 * A4 portrait with 0.5-inch margins; rows configured to never split
 * across pages so the items / bank tables stay visually intact.
 */
export async function htmlToDocx(html: string): Promise<Buffer> {
  const result = await HTMLtoDOCX(html, null, {
    orientation: "portrait",
    // A4 dimensions in twips (1 inch = 1440 twips, A4 = 8.27" × 11.69")
    pageSize: { width: 11906, height: 16838 },
    // 0.5-inch margins on every side (720 twips). Tighter than Word's
    // default 1" so the items table doesn't wrap when it has 8 columns.
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
    table: { row: { cantSplit: true } },
    footer: false,
    header: false,
    pageNumber: false,
    fontTable: undefined,
  });
  if (Buffer.isBuffer(result)) return result;
  return Buffer.from(result as ArrayBuffer);
}

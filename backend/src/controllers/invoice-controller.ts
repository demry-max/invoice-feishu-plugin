import type { Request, Response } from 'express';
import type { PreviewRequest, GenerateRequest, ApiResponse, PreviewResponse, GenerateResponse } from '../types';
import {
  previewInvoice,
  generateInvoice,
  getInvoiceHtml,
  getInvoicePdf,
  getInvoiceDocx,
  getInvoice,
  listInvoicesForSourceRecord,
} from '../services/invoice-service';
import type { Invoice } from '../types';
import { createFeishuAdapter } from '../adapters/feishu-adapter';

const feishu = createFeishuAdapter();

/** Characters illegal in file names on Windows / macOS / Linux + control chars. */
function sanitizeFilenamePart(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Per consultant spec: PDF/Word filename is `{invoiceNo}_{companyName}`
 * (or `{invoiceNo}_{billTo}` when company name is empty). Final-payment and
 * unknown invoices fall back to `{invoiceNo}`. Returns the base name WITHOUT
 * extension.
 */
function invoiceFileBaseName(invoiceNo: string, invoice?: Invoice): string {
  if (invoice && invoice.invoice_type !== 'final_payment') {
    const company = sanitizeFilenamePart(invoice.company_name ?? '');
    const billTo = sanitizeFilenamePart(invoice.bill_to ?? '');
    const namePart = company || billTo;
    if (namePart) return `${invoiceNo}_${namePart}`;
  }
  return invoiceNo;
}

/**
 * Build a Content-Disposition header value that works with non-ASCII
 * (e.g. Chinese) file names: an ASCII fallback `filename=` plus an
 * RFC 5987 `filename*=UTF-8''<percent-encoded>` variant that modern
 * browsers prefer.
 */
function contentDisposition(
  disposition: 'inline' | 'attachment',
  baseName: string,
  ext: string,
): string {
  const asciiFallback = `${baseName.replace(/[^\x20-\x7e]/g, '_')}.${ext}`;
  const utf8 = encodeURIComponent(`${baseName}.${ext}`);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${utf8}`;
}

/** POST /api/invoices/preview */
export async function handlePreview(req: Request, res: Response): Promise<void> {
  try {
    const body: PreviewRequest = req.body;

    if (!body.items || body.items.length === 0) {
      res.status(400).json({ success: false, error: 'No items provided' } as ApiResponse<null>);
      return;
    }

    const result = previewInvoice(body);
    res.json({ success: true, data: result } as ApiResponse<PreviewResponse>);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** POST /api/invoices/generate */
export async function handleGenerate(req: Request, res: Response): Promise<void> {
  try {
    const body: GenerateRequest = req.body;

    if (!body.items || body.items.length === 0) {
      res.status(400).json({ success: false, error: 'No items provided' } as ApiResponse<null>);
      return;
    }

    // Per spec req 1: consultant invoices accept EITHER bill_to OR company_name.
    // Final-payment invoices still require bill_to.
    const hasBillTo = typeof body.bill_to === 'string' && body.bill_to.trim().length > 0;
    const hasCompanyName = typeof body.company_name === 'string' && body.company_name.trim().length > 0;
    const isConsultant = body.invoice_type !== 'final_payment';
    if (isConsultant) {
      if (!hasBillTo && !hasCompanyName) {
        res.status(400).json({
          success: false,
          error: 'bill_to or company_name is required for consultant invoices',
        } as ApiResponse<null>);
        return;
      }
    } else if (!hasBillTo) {
      res.status(400).json({ success: false, error: 'bill_to is required' } as ApiResponse<null>);
      return;
    }

    const result = await generateInvoice(body);

    // 写入飞书表（非阻塞，错误不影响主流程）
    try {
      await feishu.writeInvoice(result.invoice);
      await feishu.writeInvoiceItems(result.invoice.items);
      await feishu.updateInvoiceUrls(result.invoice_no, result.html_url, result.pdf_url);
    } catch (feishuErr) {
      console.warn('Feishu write failed (non-blocking):', feishuErr);
    }

    res.json({ success: true, data: result } as ApiResponse<GenerateResponse>);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** GET /api/invoices/:invoiceNo/html */
export async function handleGetHtml(req: Request, res: Response): Promise<void> {
  try {
    const invoiceNo = req.params['invoiceNo'] as string;
    const html = getInvoiceHtml(invoiceNo);

    if (!html) {
      res.status(404).json({ success: false, error: 'Invoice not found' } as ApiResponse<null>);
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('GetHtml error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** GET /api/invoices/:invoiceNo/pdf */
export async function handleGetPdf(req: Request, res: Response): Promise<void> {
  try {
    const invoiceNo = req.params['invoiceNo'] as string;
    const pdf = getInvoicePdf(invoiceNo);

    if (!pdf) {
      res.status(404).json({ success: false, error: 'Invoice not found' } as ApiResponse<null>);
      return;
    }

    const baseName = invoiceFileBaseName(invoiceNo, getInvoice(invoiceNo));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      contentDisposition('inline', baseName, 'pdf'),
    );
    res.send(pdf);
  } catch (err) {
    console.error('GetPdf error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** GET /api/invoices/:invoiceNo/docx — per spec req 2 (consultant invoices) */
export async function handleGetDocx(req: Request, res: Response): Promise<void> {
  try {
    const invoiceNo = req.params['invoiceNo'] as string;
    const docx = await getInvoiceDocx(invoiceNo);

    if (!docx) {
      res.status(404).json({ success: false, error: 'Invoice not found' } as ApiResponse<null>);
      return;
    }

    const baseName = invoiceFileBaseName(invoiceNo, getInvoice(invoiceNo));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      contentDisposition('attachment', baseName, 'docx'),
    );
    res.send(docx);
  } catch (err) {
    console.error('GetDocx error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** GET /api/invoices/by-source/:recordId - list invoices referencing a source record */
export async function handleListBySource(req: Request, res: Response): Promise<void> {
  try {
    const recordId = req.params['recordId'] as string;
    if (!recordId) {
      res.status(400).json({ success: false, error: 'recordId required' } as ApiResponse<null>);
      return;
    }
    const invoices = listInvoicesForSourceRecord(recordId);
    res.json({ success: true, data: invoices } as ApiResponse<Invoice[]>);
  } catch (err) {
    console.error('ListBySource error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

/** GET /api/mock/source-items - 返回 mock 数据（开发用） */
export async function handleGetMockItems(req: Request, res: Response): Promise<void> {
  try {
    const items = await feishu.getSelectedSourceItems();
    res.json({ success: true, data: items } as ApiResponse<typeof items>);
  } catch (err) {
    console.error('GetMockItems error:', err);
    res.status(500).json({ success: false, error: String(err) } as ApiResponse<null>);
  }
}

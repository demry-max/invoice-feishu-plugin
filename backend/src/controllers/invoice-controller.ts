import type { Request, Response } from 'express';
import type { PreviewRequest, GenerateRequest, ApiResponse, PreviewResponse, GenerateResponse } from '../types';
import {
  previewInvoice,
  generateInvoice,
  getInvoiceHtml,
  getInvoicePdf,
} from '../services/invoice-service';
import { createFeishuAdapter } from '../adapters/feishu-adapter';

const feishu = createFeishuAdapter();

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

    if (!body.bill_to) {
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceNo}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('GetPdf error:', err);
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

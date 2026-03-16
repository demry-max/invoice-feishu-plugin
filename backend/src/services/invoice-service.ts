import fs from 'fs';
import path from 'path';
import type {
  SourceItem,
  Invoice,
  InvoiceItem,
  PreviewRequest,
  PreviewResponse,
  GenerateRequest,
  GenerateResponse,
  CompanyConfig,
} from '../types';
import { buildInvoiceItems, calcSubtotal, calcVat, calcGrandTotal } from '../utils/calculation';
import { generateInvoiceNo } from '../utils/invoice-no';
import { mergeCompanyConfig } from '../utils/config';
import { renderInvoiceHtml } from '../templates/invoice-template';
import { htmlToPdf } from './pdf-service';

const VAT_RATE = 6;
const OUTPUT_DIR = path.join(__dirname, '../../output');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 内存存储（MVP 阶段，后续替换为数据库或飞书表）
const invoiceStore = new Map<string, Invoice>();

/** 预览账单 - 不落库 */
export function previewInvoice(req: PreviewRequest): PreviewResponse {
  const items = buildInvoiceItems(req.items, 'PREVIEW');
  const subtotal = calcSubtotal(items);
  const vatAmount = calcVat(subtotal, VAT_RATE);
  const grandTotal = calcGrandTotal(subtotal, vatAmount);

  return {
    items,
    subtotal,
    vat_rate: VAT_RATE,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    currency: req.currency || '¥',
  };
}

/** 生成正式账单 */
export async function generateInvoice(req: GenerateRequest): Promise<GenerateResponse> {
  const invoiceNo = generateInvoiceNo();
  const invoiceDate = req.invoice_date || new Date().toISOString().split('T')[0];
  const currency = req.currency || '¥';
  const config = mergeCompanyConfig(req.company_config);

  const items = buildInvoiceItems(req.items, invoiceNo);
  const subtotal = calcSubtotal(items);
  const vatAmount = calcVat(subtotal, VAT_RATE);
  const grandTotal = calcGrandTotal(subtotal, vatAmount);

  const invoice: Invoice = {
    invoice_no: invoiceNo,
    company_name: req.company_name,
    bill_to: req.bill_to,
    invoice_date: invoiceDate,
    subtotal,
    vat_rate: VAT_RATE,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    currency,
    footer_note: config.tax_note,
    bank_account_name: config.bank_account_name,
    bank_account_number: config.bank_account_number,
    bank_name: config.bank_name,
    source_record_ids: req.items.map((i) => i.record_id).filter(Boolean) as string[],
    created_at: new Date().toISOString(),
    status: 'generated',
    items,
  };

  // 生成 HTML
  const html = renderInvoiceHtml(invoice, config);
  const htmlFilename = `${invoiceNo}.html`;
  fs.writeFileSync(path.join(OUTPUT_DIR, htmlFilename), html, 'utf-8');

  // 生成 PDF
  const pdfBuffer = await htmlToPdf(html);
  const pdfFilename = `${invoiceNo}.pdf`;
  fs.writeFileSync(path.join(OUTPUT_DIR, pdfFilename), pdfBuffer);

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  invoice.html_url = `${baseUrl}/api/invoices/${invoiceNo}/html`;
  invoice.pdf_url = `${baseUrl}/api/invoices/${invoiceNo}/pdf`;

  // 存储
  invoiceStore.set(invoiceNo, invoice);

  return {
    invoice_no: invoiceNo,
    html_url: invoice.html_url,
    pdf_url: invoice.pdf_url,
    invoice,
  };
}

/** 获取账单 HTML 内容 */
export function getInvoiceHtml(invoiceNo: string): string | null {
  const htmlPath = path.join(OUTPUT_DIR, `${invoiceNo}.html`);
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, 'utf-8');
  }
  return null;
}

/** 获取账单 PDF Buffer */
export function getInvoicePdf(invoiceNo: string): Buffer | null {
  const pdfPath = path.join(OUTPUT_DIR, `${invoiceNo}.pdf`);
  if (fs.existsSync(pdfPath)) {
    return fs.readFileSync(pdfPath);
  }
  return null;
}

/** 获取账单数据 */
export function getInvoice(invoiceNo: string): Invoice | undefined {
  return invoiceStore.get(invoiceNo);
}

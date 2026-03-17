import fs from "fs";
import path from "path";
import type {
  SourceItem,
  Invoice,
  InvoiceItem,
  PreviewRequest,
  PreviewResponse,
  GenerateRequest,
  GenerateResponse,
  CompanyConfig,
  BankAccount,
  TaxMode,
  BrandTemplateId,
} from "../types";
import {
  buildInvoiceItems,
  calcSubtotal,
  calcVat,
  calcGrandTotal,
} from "../utils/calculation";
import { generateInvoiceNo } from "../utils/invoice-no";
import { getCompanyConfigForTemplate } from "../utils/config";
import { renderByTemplate } from "../templates/template-registry";
import { findBankAccount, getDefaultBankAccount } from "../utils/bank-accounts";
import { htmlToPdf } from "./pdf-service";

const DEFAULT_VAT_RATE = 6;
const OUTPUT_DIR = path.join(__dirname, "../../output");

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 内存存储（MVP 阶段）
const invoiceStore = new Map<string, Invoice>();

/** 每个模板的默认银行账户 */
const DEFAULT_BANK_BY_TEMPLATE: Record<BrandTemplateId, string> = {
  feilong: "feilong-minsheng",
  starlight: "starlight-bdo-php",
};

/** 解析银行账户 */
function resolveBankAccount(
  bankAccountId?: string,
  templateId?: BrandTemplateId,
): BankAccount {
  if (bankAccountId) {
    const found = findBankAccount(bankAccountId);
    if (found) return found;
  }
  // 根据模板选择默认银行
  const defaultId = DEFAULT_BANK_BY_TEMPLATE[templateId ?? "feilong"];
  const defaultForTemplate = findBankAccount(defaultId);
  if (defaultForTemplate) return defaultForTemplate;
  return getDefaultBankAccount();
}

/** 解析税率 - 含税模式下 VAT 为 0 */
function resolveVatRate(taxMode: TaxMode): number {
  return taxMode === "tax_included" ? 0 : DEFAULT_VAT_RATE;
}

/** 预览账单 - 不落库 */
export function previewInvoice(req: PreviewRequest): PreviewResponse {
  const taxMode: TaxMode = req.tax_mode ?? "tax_excluded";
  const vatRate = resolveVatRate(taxMode);
  const items = buildInvoiceItems(req.items, "PREVIEW");
  const subtotal = calcSubtotal(items);
  const vatAmount = calcVat(subtotal, vatRate);
  const grandTotal = calcGrandTotal(subtotal, vatAmount);

  return {
    items,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    currency: req.currency || "¥",
    tax_mode: taxMode,
  };
}

/** 生成正式账单 */
export async function generateInvoice(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const invoiceNo = generateInvoiceNo();
  const invoiceDate =
    req.invoice_date || new Date().toISOString().split("T")[0];
  const currency = req.currency || "¥";
  const taxMode: TaxMode = req.tax_mode ?? "tax_excluded";
  const templateId: BrandTemplateId = req.template_id ?? "feilong";
  const vatRate = resolveVatRate(taxMode);
  const config = getCompanyConfigForTemplate(templateId, req.company_config);
  const bankAccount = resolveBankAccount(req.bank_account_id, templateId);

  const items = buildInvoiceItems(req.items, invoiceNo);
  const subtotal = calcSubtotal(items);
  const vatAmount = calcVat(subtotal, vatRate);
  const grandTotal = calcGrandTotal(subtotal, vatAmount);

  const invoice: Invoice = {
    invoice_no: invoiceNo,
    company_name: req.company_name,
    bill_to: req.bill_to,
    invoice_date: invoiceDate,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    currency,
    tax_mode: taxMode,
    template_id: templateId,
    footer_note: config.tax_note,
    bank_account: bankAccount,
    source_record_ids: req.items
      .map((i) => i.record_id)
      .filter(Boolean) as string[],
    created_at: new Date().toISOString(),
    status: "generated",
    items,
  };

  // 生成 HTML（使用模板注册表）
  const html = renderByTemplate(templateId, invoice, config, bankAccount);
  const htmlFilename = `${invoiceNo}.html`;
  fs.writeFileSync(path.join(OUTPUT_DIR, htmlFilename), html, "utf-8");

  // 生成 PDF
  const pdfBuffer = await htmlToPdf(html);
  const pdfFilename = `${invoiceNo}.pdf`;
  fs.writeFileSync(path.join(OUTPUT_DIR, pdfFilename), pdfBuffer);

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
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
    return fs.readFileSync(htmlPath, "utf-8");
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

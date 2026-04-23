import fs from "fs";
import path from "path";
import type {
  Invoice,
  PreviewRequest,
  PreviewResponse,
  GenerateRequest,
  GenerateResponse,
  BankAccount,
  TaxMode,
  BrandTemplateId,
  InvoiceType,
} from "../types";
import {
  buildInvoiceItems,
  calcSubtotal,
  calcTaxableSubtotal,
  calcVat,
  calcEwt,
  calcConsultantGrandTotal,
  calcFinalPaymentGrandTotal,
  aggregateFinalPaymentContext,
  DEFAULT_VAT_RATE,
  EWT_RATE,
} from "../utils/calculation";
import { generateInvoiceNo } from "../utils/invoice-no";
import { getCompanyConfigForTemplate } from "../utils/config";
import { renderByTemplate } from "../templates/template-registry";
import { findBankAccount, getDefaultBankAccount } from "../utils/bank-accounts";
import { htmlToPdf } from "./pdf-service";
import { openStore, type InvoiceStore } from "../utils/invoice-store";

const DATA_DIR =
  process.env.DATA_DIR || path.join(__dirname, "../../data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const OUTPUT_DIR = DATA_DIR;
const invoiceStore: InvoiceStore = openStore(
  path.join(DATA_DIR, "invoices.db"),
);

const DEFAULT_BANK_BY_TEMPLATE: Record<BrandTemplateId, string> = {
  feilong: "feilong-minsheng",
  starlight: "starlight-bdo-php",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  PHP: "₱",
};

function resolveBankAccount(
  bankAccountId?: string,
  templateId?: BrandTemplateId,
): BankAccount {
  if (bankAccountId) {
    const found = findBankAccount(bankAccountId);
    if (found) return found;
  }
  const defaultId = DEFAULT_BANK_BY_TEMPLATE[templateId ?? "feilong"];
  const defaultForTemplate = findBankAccount(defaultId);
  if (defaultForTemplate) return defaultForTemplate;
  return getDefaultBankAccount();
}

function resolveVatRate(taxMode: TaxMode, override?: number): number {
  if (typeof override === "number" && override >= 0) return override;
  return taxMode === "tax_included" ? 0 : DEFAULT_VAT_RATE;
}

function pickCurrencySymbol(
  invoiceType: InvoiceType,
  displayCurrency: string | undefined,
  fallback: string,
): string {
  if (invoiceType !== "final_payment") return fallback;
  if (!displayCurrency) return fallback;
  return CURRENCY_SYMBOL[displayCurrency.toUpperCase()] ?? fallback;
}

export function previewInvoice(req: PreviewRequest): PreviewResponse {
  const taxMode: TaxMode = req.tax_mode ?? "tax_excluded";
  const invoiceType: InvoiceType = req.invoice_type ?? "consultant";
  const exchangeRate =
    typeof req.exchange_rate === "number" && req.exchange_rate > 0
      ? req.exchange_rate
      : 1;

  const items = buildInvoiceItems(req.items, "PREVIEW", {
    invoiceType,
    exchangeRate,
  });
  const subtotal = calcSubtotal(items);
  const currency = pickCurrencySymbol(
    invoiceType,
    req.display_currency,
    req.currency || "¥",
  );

  if (invoiceType === "final_payment") {
    const { amountPaidTotal, amountRefunded, totalDeductionAmount } =
      aggregateFinalPaymentContext(req.items);
    const grandTotal = calcFinalPaymentGrandTotal(
      subtotal,
      amountPaidTotal * exchangeRate,
      totalDeductionAmount * exchangeRate,
      amountRefunded * exchangeRate,
    );
    return {
      items,
      subtotal,
      vat_rate: 0,
      vat_amount: 0,
      grand_total: grandTotal,
      currency,
      tax_mode: taxMode,
      invoice_type: invoiceType,
      amount_paid_total: amountPaidTotal * exchangeRate,
      amount_refunded: amountRefunded * exchangeRate,
      total_deduction_amount: totalDeductionAmount * exchangeRate,
      exchange_rate: exchangeRate,
      display_currency: req.display_currency,
    };
  }

  // consultant (default)
  const vatRate = resolveVatRate(taxMode, req.vat_rate_percent);
  const taxableSubtotal = calcTaxableSubtotal(items);
  const vatAmount = calcVat(taxableSubtotal, vatRate);
  const ewtAmount = calcEwt(taxableSubtotal);
  const grandTotal = calcConsultantGrandTotal(subtotal, vatAmount, ewtAmount);

  return {
    items,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    currency,
    tax_mode: taxMode,
    invoice_type: invoiceType,
    taxable_subtotal: taxableSubtotal,
    ewt_rate: EWT_RATE,
    ewt_amount: ewtAmount,
  };
}

export async function generateInvoice(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const invoiceNo = generateInvoiceNo();
  const invoiceDate =
    req.invoice_date || new Date().toISOString().split("T")[0];
  const taxMode: TaxMode = req.tax_mode ?? "tax_excluded";
  const templateId: BrandTemplateId = req.template_id ?? "feilong";
  const invoiceType: InvoiceType = req.invoice_type ?? "consultant";
  const exchangeRate =
    typeof req.exchange_rate === "number" && req.exchange_rate > 0
      ? req.exchange_rate
      : 1;
  const config = getCompanyConfigForTemplate(templateId, req.company_config);
  const bankAccount = resolveBankAccount(req.bank_account_id, templateId);
  const currency = pickCurrencySymbol(
    invoiceType,
    req.display_currency,
    req.currency || "¥",
  );

  const items = buildInvoiceItems(req.items, invoiceNo, {
    invoiceType,
    exchangeRate,
  });
  const subtotal = calcSubtotal(items);

  let invoice: Invoice;
  if (invoiceType === "final_payment") {
    const { amountPaidTotal, amountRefunded, totalDeductionAmount } =
      aggregateFinalPaymentContext(req.items);
    const grandTotal = calcFinalPaymentGrandTotal(
      subtotal,
      amountPaidTotal * exchangeRate,
      totalDeductionAmount * exchangeRate,
      amountRefunded * exchangeRate,
    );
    invoice = {
      invoice_no: invoiceNo,
      company_name: req.company_name,
      bill_to: req.bill_to,
      invoice_date: invoiceDate,
      subtotal,
      vat_rate: 0,
      vat_amount: 0,
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
      invoice_type: invoiceType,
      amount_paid_total: amountPaidTotal * exchangeRate,
      amount_refunded: amountRefunded * exchangeRate,
      total_deduction_amount: totalDeductionAmount * exchangeRate,
      exchange_rate: exchangeRate,
      display_currency: req.display_currency,
    };
  } else {
    const vatRate = resolveVatRate(taxMode, req.vat_rate_percent);
    const taxableSubtotal = calcTaxableSubtotal(items);
    const vatAmount = calcVat(taxableSubtotal, vatRate);
    const ewtAmount = calcEwt(taxableSubtotal);
    const grandTotal = calcConsultantGrandTotal(subtotal, vatAmount, ewtAmount);
    invoice = {
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
      invoice_type: invoiceType,
      taxable_subtotal: taxableSubtotal,
      ewt_rate: EWT_RATE,
      ewt_amount: ewtAmount,
    };
  }

  const html = renderByTemplate(templateId, invoice, config, bankAccount);
  const htmlFilename = `${invoiceNo}.html`;
  fs.writeFileSync(path.join(OUTPUT_DIR, htmlFilename), html, "utf-8");

  const pdfBuffer = await htmlToPdf(html);
  const pdfFilename = `${invoiceNo}.pdf`;
  fs.writeFileSync(path.join(OUTPUT_DIR, pdfFilename), pdfBuffer);

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  invoice.html_url = `${baseUrl}/api/invoices/${invoiceNo}/html`;
  invoice.pdf_url = `${baseUrl}/api/invoices/${invoiceNo}/pdf`;

  invoiceStore.insert(invoice);

  return {
    invoice_no: invoiceNo,
    html_url: invoice.html_url,
    pdf_url: invoice.pdf_url,
    invoice,
  };
}

export function getInvoiceHtml(invoiceNo: string): string | null {
  const htmlPath = path.join(OUTPUT_DIR, `${invoiceNo}.html`);
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, "utf-8");
  }
  return null;
}

export function getInvoicePdf(invoiceNo: string): Buffer | null {
  const pdfPath = path.join(OUTPUT_DIR, `${invoiceNo}.pdf`);
  if (fs.existsSync(pdfPath)) {
    return fs.readFileSync(pdfPath);
  }
  return null;
}

export function getInvoice(invoiceNo: string): Invoice | undefined {
  return invoiceStore.get(invoiceNo);
}

/** List invoices that reference a specific source (work-order) record id */
export function listInvoicesForSourceRecord(recordId: string): Invoice[] {
  return invoiceStore.listBySourceRecord(recordId);
}

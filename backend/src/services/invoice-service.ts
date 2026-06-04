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
  calcTotalBalance,
  calcFinalBalance,
  aggregateFinalPaymentContext,
  DEFAULT_VAT_RATE,
  EWT_RATE,
  round2,
} from "../utils/calculation";
import { generateInvoiceNo } from "../utils/invoice-no";
import { getCompanyConfigForTemplate } from "../utils/config";
import { renderByTemplate } from "../templates/template-registry";
import { findBankAccount, getDefaultBankAccount } from "../utils/bank-accounts";
import { htmlToPdf } from "./pdf-service";
import { htmlToDocx } from "./docx-service";
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

// Per-month minimum-suffix floors are no longer needed: the new generator
// uses a random 5-digit suffix in [10000, 99999] and retries on collision
// against the local invoice store, so it can't reuse a stale sequential
// number that other environments already issued.

const DEFAULT_BANK_BY_TEMPLATE: Record<BrandTemplateId, string> = {
  feilong: "feilong-minsheng",
  starlight: "starlight-bdo-php",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  PHP: "₱",
  THB: "฿",
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

/**
 * Consultant-invoice VAT resolution (new semantics — 2026-04-24):
 *   tax_mode = "tax_excluded" (UI: 不含税) → no VAT
 *   tax_mode = "tax_included" (UI: 含税)   → vat_rate_percent from request, default 6
 */
function resolveConsultantVatRate(
  taxMode: TaxMode,
  override?: number,
): number {
  if (taxMode !== "tax_included") return 0;
  if (typeof override === "number" && override >= 0) return override;
  return DEFAULT_VAT_RATE;
}

/**
 * For the "reuse on regenerate" rule: pick the first existing invoice of the
 * same type tied to any of the source records. Returns its invoice_no, or
 * undefined when none exists.
 */
function findExistingInvoiceNoForType(
  sources: ReadonlyArray<{ record_id?: string; bill_number?: string }>,
  invoiceType: InvoiceType,
): string | undefined {
  // Source-of-truth #1 — local invoice store (covers same-process regenerate).
  for (const s of sources) {
    if (!s.record_id) continue;
    const matches = invoiceStore.listBySourceRecord(s.record_id);
    const same = matches.find((i) => i.invoice_type === invoiceType);
    if (same) return same.invoice_no;
  }
  // Source-of-truth #2 — Bitable's own Bill Number column (covers the case
  // where the local SQLite was wiped by a container rebuild but the Bitable
  // row still carries the previously-issued invoice number). Without this,
  // a regenerate would mint a new random invoice number and the previous
  // PDF/HTML files plus the link the customer received would point at a
  // stale row that no longer matches what's on Bitable.
  //
  // Only consultant invoices use the main-table "Bill Number" column; final-
  // payment uses Final Bill Number which the adapter maps to its own field.
  if (invoiceType === "consultant") {
    for (const s of sources) {
      const candidate = (s.bill_number ?? "").trim();
      if (candidate) return candidate;
    }
  }
  return undefined;
}

/**
 * EWT rate resolution (2026-05-18 spec):
 *   tax_mode = "tax_excluded" (不含税)                  → 0
 *   tax_mode = "tax_included" + templateId = feilong    → 0 (菲龙咨询 never charges EWT)
 *   tax_mode = "tax_included" + templateId = starlight  → override ∈ {2,10,15}, default 2
 */
function resolveConsultantEwtRate(
  taxMode: TaxMode,
  templateId: BrandTemplateId,
  override?: number,
): number {
  if (taxMode !== "tax_included") return 0;
  if (templateId !== "starlight") return 0;
  if (typeof override === "number" && override >= 0) return override;
  return EWT_RATE;
}

function pickCurrencySymbol(
  _invoiceType: InvoiceType,
  displayCurrency: string | undefined,
  fallback: string,
): string {
  // Per spec req 3 — Display Currency now applies to BOTH invoice types
  // (previously gated to final_payment only).
  if (!displayCurrency) return fallback;
  return CURRENCY_SYMBOL[displayCurrency.toUpperCase()] ?? fallback;
}

/**
 * Default business-day window before the final installment payment is due.
 * Per spec req 4 — '{x} 个工作日内支付' defaults to 30 when the user has not
 * overridden it. Operators can override per invoice via req.installment.
 */
const DEFAULT_FINAL_PAYMENT_BUSINESS_DAYS = 30;

/**
 * Compute installment-payment info for consultant invoices (per spec req 4).
 * The formula is applied per-line so that mixed-ratio service rows produce
 * an accurate first-payment amount; the displayed first-payment percentage
 * comes from the main ticket. All five values are overridable from req.installment.
 */
function computeInstallmentInfo(
  sources: ReadonlyArray<{
    first_payment_ratio?: number;
    main_first_payment_ratio?: number;
  }>,
  items: ReadonlyArray<{ line_total: number }>,
  vatAmount: number,
  ewtAmount: number,
  grandTotal: number,
  override?: Partial<{
    first_payment_ratio: number;
    final_payment_ratio: number;
    first_payment_amount: number;
    final_payment_amount: number;
    final_payment_business_days: number;
  }>,
): {
  first_payment_ratio: number;
  final_payment_ratio: number;
  first_payment_amount: number;
  final_payment_amount: number;
  final_payment_business_days: number;
} {
  // Display percentage comes from the main ticket; fall back to the first
  // non-empty per-row ratio when missing; finally to 0.5 (50/50 split).
  const fallbackMainRatio = sources.find(
    (s) => typeof s.main_first_payment_ratio === "number",
  )?.main_first_payment_ratio;
  const fallbackRowRatio = sources.find(
    (s) => typeof s.first_payment_ratio === "number",
  )?.first_payment_ratio;
  const defaultFirstRatio = clampRatio(
    typeof fallbackMainRatio === "number"
      ? fallbackMainRatio
      : typeof fallbackRowRatio === "number"
        ? fallbackRowRatio
        : 0.5,
  );

  // Amount uses per-line ratios where present (per spec); fall back to the
  // main-ticket ratio per line otherwise.
  const perLineFirstSum = sources.reduce((acc, s, idx) => {
    const lineTotal = items[idx]?.line_total ?? 0;
    const ratio = clampRatio(
      typeof s.first_payment_ratio === "number"
        ? s.first_payment_ratio
        : typeof s.main_first_payment_ratio === "number"
          ? s.main_first_payment_ratio
          : defaultFirstRatio,
    );
    return acc + lineTotal * ratio;
  }, 0);

  const defaultFirstAmount = round2(perLineFirstSum + vatAmount - ewtAmount);
  const defaultFinalAmount = round2(grandTotal - defaultFirstAmount);

  const firstRatio = clampRatio(
    typeof override?.first_payment_ratio === "number"
      ? override.first_payment_ratio
      : defaultFirstRatio,
  );
  const finalRatio = clampRatio(
    typeof override?.final_payment_ratio === "number"
      ? override.final_payment_ratio
      : 1 - firstRatio,
  );
  const firstAmount =
    typeof override?.first_payment_amount === "number"
      ? round2(override.first_payment_amount)
      : defaultFirstAmount;
  const finalAmount =
    typeof override?.final_payment_amount === "number"
      ? round2(override.final_payment_amount)
      : defaultFinalAmount;
  const businessDays =
    typeof override?.final_payment_business_days === "number" &&
    override.final_payment_business_days > 0
      ? Math.round(override.final_payment_business_days)
      : DEFAULT_FINAL_PAYMENT_BUSINESS_DAYS;

  return {
    first_payment_ratio: firstRatio,
    final_payment_ratio: finalRatio,
    first_payment_amount: firstAmount,
    final_payment_amount: finalAmount,
    final_payment_business_days: businessDays,
  };
}

function clampRatio(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function previewInvoice(req: PreviewRequest): PreviewResponse {
  // tax_mode semantics (new, 2026-04-24):
  //   tax_excluded (不含税)  → invoice has no tax (Total = Grand Total)
  //   tax_included (含税)    → VAT (user-selected) and EWT (Starlight only) apply
  // Default for both invoice types: tax_included.
  const taxMode: TaxMode = req.tax_mode ?? "tax_included";
  const invoiceType: InvoiceType = req.invoice_type ?? "consultant";
  const templateId: BrandTemplateId = req.template_id ?? "feilong";
  const legacyRate =
    typeof req.exchange_rate === "number" && req.exchange_rate > 0
      ? req.exchange_rate
      : 1;
  const rateBill =
    typeof req.exchange_rate_bill === "number" && req.exchange_rate_bill > 0
      ? req.exchange_rate_bill
      : legacyRate;
  const rateFinal =
    typeof req.exchange_rate_final === "number" && req.exchange_rate_final > 0
      ? req.exchange_rate_final
      : legacyRate;

  const items = buildInvoiceItems(req.items, "PREVIEW", {
    invoiceType,
    exchangeRateBill: rateBill,
    exchangeRateFinal: rateFinal,
    exchangeRatesPerRow: req.exchange_rates_per_row,
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
    // Paid/Refund/Deductible all ride the Bill-Currency rate.
    const paidTotal = round2(amountPaidTotal * rateBill);
    const refunded = round2(amountRefunded * rateBill);
    const deductible = round2(totalDeductionAmount * rateBill);
    const totalBalance = calcTotalBalance(items);
    const finalBalance = calcFinalBalance(totalBalance, refunded);
    return {
      items,
      subtotal,
      vat_rate: 0,
      vat_amount: 0,
      grand_total: finalBalance,
      currency,
      tax_mode: taxMode,
      invoice_type: invoiceType,
      amount_paid_total: paidTotal,
      amount_refunded: refunded,
      total_deduction_amount: deductible,
      exchange_rate: rateBill, // legacy echo
      display_currency: req.display_currency,
      total_balance: totalBalance,
      final_balance: finalBalance,
    };
  }

  // consultant (default)
  const vatRate = resolveConsultantVatRate(taxMode, req.vat_rate_percent);
  const ewtRate = resolveConsultantEwtRate(
    taxMode,
    templateId,
    req.ewt_rate_percent,
  );
  const taxableSubtotal = calcTaxableSubtotal(items);
  const vatAmount = calcVat(taxableSubtotal, vatRate);
  const ewtAmount = calcEwt(taxableSubtotal, ewtRate);
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
    ewt_rate: ewtRate,
    ewt_amount: ewtAmount,
    // Always expose installment defaults in the preview so the UI can show
    // them inline even when the toggle is off (per spec req 4).
    installment_info: computeInstallmentInfo(
      req.items,
      items,
      vatAmount,
      ewtAmount,
      grandTotal,
    ),
  };
}

export async function generateInvoice(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  // Reuse-on-regenerate rule (2026-05-18 spec): if any of the source records
  // already has an invoice of the same type, REUSE that invoice number — applies
  // to both consultant and final_payment.
  const invoiceType: InvoiceType = req.invoice_type ?? "consultant";
  const existingNo = findExistingInvoiceNoForType(req.items, invoiceType);
  // Use a random 5-digit suffix and retry on collision against the local
  // invoice store. The 90 000-value space avoids reusing numbers issued
  // either by previous container instances or hand-edited rows on Bitable
  // (whose lowest sequential numbers like 00001 are well outside the random
  // 10000–99999 range used here).
  const invoiceNo =
    existingNo ??
    generateInvoiceNo({
      exists: (candidate) => invoiceStore.get(candidate) !== undefined,
    });
  const invoiceDate =
    req.invoice_date || new Date().toISOString().split("T")[0];
  // Default tax mode to tax_included (see previewInvoice for semantics).
  const taxMode: TaxMode = req.tax_mode ?? "tax_included";
  const templateId: BrandTemplateId = req.template_id ?? "feilong";
  const legacyRate =
    typeof req.exchange_rate === "number" && req.exchange_rate > 0
      ? req.exchange_rate
      : 1;
  const rateBill =
    typeof req.exchange_rate_bill === "number" && req.exchange_rate_bill > 0
      ? req.exchange_rate_bill
      : legacyRate;
  const rateFinal =
    typeof req.exchange_rate_final === "number" && req.exchange_rate_final > 0
      ? req.exchange_rate_final
      : legacyRate;
  const config = getCompanyConfigForTemplate(templateId, req.company_config);
  const bankAccount = resolveBankAccount(req.bank_account_id, templateId);
  const currency = pickCurrencySymbol(
    invoiceType,
    req.display_currency,
    req.currency || "¥",
  );

  const items = buildInvoiceItems(req.items, invoiceNo, {
    invoiceType,
    exchangeRateBill: rateBill,
    exchangeRateFinal: rateFinal,
    exchangeRatesPerRow: req.exchange_rates_per_row,
  });
  const subtotal = calcSubtotal(items);

  let invoice: Invoice;
  if (invoiceType === "final_payment") {
    const { amountPaidTotal, amountRefunded, totalDeductionAmount } =
      aggregateFinalPaymentContext(req.items);
    const paidTotal = round2(amountPaidTotal * rateBill);
    const refunded = round2(amountRefunded * rateBill);
    const deductible = round2(totalDeductionAmount * rateBill);
    const totalBalance = calcTotalBalance(items);
    const finalBalance = calcFinalBalance(totalBalance, refunded);
    invoice = {
      invoice_no: invoiceNo,
      company_name: req.company_name,
      bill_to: req.bill_to,
      invoice_date: invoiceDate,
      subtotal,
      vat_rate: 0,
      vat_amount: 0,
      grand_total: finalBalance,
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
      amount_paid_total: paidTotal,
      amount_refunded: refunded,
      total_deduction_amount: deductible,
      exchange_rate: rateBill,
      display_currency: req.display_currency,
      total_balance: totalBalance,
      final_balance: finalBalance,
      client_name: req.bill_to,
      client_company: req.company_name,
    };
  } else {
    const vatRate = resolveConsultantVatRate(taxMode, req.vat_rate_percent);
    const ewtRate = resolveConsultantEwtRate(
      taxMode,
      templateId,
      req.ewt_rate_percent,
    );
    const taxableSubtotal = calcTaxableSubtotal(items);
    const vatAmount = calcVat(taxableSubtotal, vatRate);
    const ewtAmount = calcEwt(taxableSubtotal, ewtRate);
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
      ewt_rate: ewtRate,
      ewt_amount: ewtAmount,
      // Per spec req 3 — Display Currency is recorded on consultant invoices
      // too so write-back can mirror it to Business Ticket.Bill Display Currency
      // and Task Detail List.Bill Display Currency.
      display_currency: req.display_currency,
    };

    // Per spec req 4 — only attach installment info when the user opted in.
    if (req.show_installment) {
      invoice.installment_info = computeInstallmentInfo(
        req.items,
        items,
        vatAmount,
        ewtAmount,
        grandTotal,
        req.installment,
      );
    }
  }

  // Compute URLs BEFORE rendering so QR can point at the correct html_url
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  invoice.html_url = `${baseUrl}/api/invoices/${invoiceNo}/html`;
  invoice.pdf_url = `${baseUrl}/api/invoices/${invoiceNo}/pdf`;
  // Per spec req 2 — also expose a Word (.docx) link for consultant invoices.
  // Final-payment invoices skip the Word artifact (spec scopes this to consultant).
  if (invoiceType === "consultant") {
    invoice.word_url = `${baseUrl}/api/invoices/${invoiceNo}/docx`;
  }

  const html = await renderByTemplate(templateId, invoice, config, bankAccount);
  const htmlFilename = `${invoiceNo}.html`;
  fs.writeFileSync(path.join(OUTPUT_DIR, htmlFilename), html, "utf-8");

  const pdfBuffer = await htmlToPdf(html);
  const pdfFilename = `${invoiceNo}.pdf`;
  fs.writeFileSync(path.join(OUTPUT_DIR, pdfFilename), pdfBuffer);

  // Eagerly generate the .docx for consultant invoices so the link works
  // immediately (and any rendering failure surfaces at generate-time, not
  // later when a finance user clicks the link).
  if (invoiceType === "consultant") {
    try {
      const docxBuffer = await htmlToDocx(html);
      fs.writeFileSync(path.join(OUTPUT_DIR, `${invoiceNo}.docx`), docxBuffer);
    } catch (err) {
      console.warn(
        "[invoice-service] .docx generation failed (non-fatal):",
        err,
      );
      invoice.word_url = undefined;
    }
  }

  invoiceStore.insert(invoice);

  return {
    invoice_no: invoiceNo,
    html_url: invoice.html_url,
    pdf_url: invoice.pdf_url,
    word_url: invoice.word_url,
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

/**
 * Per spec req 2 — return the .docx blob for an invoice. Falls back to
 * lazily regenerating it from the stored HTML if the .docx was deleted
 * or the invoice was generated before .docx support shipped.
 */
export async function getInvoiceDocx(
  invoiceNo: string,
): Promise<Buffer | null> {
  const docxPath = path.join(OUTPUT_DIR, `${invoiceNo}.docx`);
  if (fs.existsSync(docxPath)) {
    return fs.readFileSync(docxPath);
  }
  const html = getInvoiceHtml(invoiceNo);
  if (!html) return null;
  try {
    const docxBuffer = await htmlToDocx(html);
    fs.writeFileSync(docxPath, docxBuffer);
    return docxBuffer;
  } catch (err) {
    console.warn("[invoice-service] lazy .docx generation failed:", err);
    return null;
  }
}

export function getInvoice(invoiceNo: string): Invoice | undefined {
  return invoiceStore.get(invoiceNo);
}

/** List invoices that reference a specific source (work-order) record id */
export function listInvoicesForSourceRecord(recordId: string): Invoice[] {
  return invoiceStore.listBySourceRecord(recordId);
}

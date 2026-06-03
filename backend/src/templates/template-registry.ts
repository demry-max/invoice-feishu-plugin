import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import type {
  Invoice,
  CompanyConfig,
  BankAccount,
  BrandTemplateId,
} from "../types";

/** Render the invoice's html_url as a base64 PNG QR data URI (~128x128). */
async function renderQrDataUri(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 128,
      margin: 0,
      color: { dark: "#222222", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}

// ============================================================
// CSS cache
// ============================================================
function loadCss(filename: string): string {
  return fs.readFileSync(path.join(__dirname, filename), "utf-8");
}

const CSS_CACHE: Record<string, string> = {};

function getCss(filename: string): string {
  if (!CSS_CACHE[filename]) {
    CSS_CACHE[filename] = loadCss(filename);
  }
  return CSS_CACHE[filename];
}

// ============================================================
// Logo cache
// ============================================================
function loadLogoBase64(filename: string): string {
  // In compiled output __dirname = dist/backend/src/templates
  // We need to reach the project root (where logo.png lives)
  const logoPath = path.resolve(__dirname, "../../../../..", filename);
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

const LOGO_CACHE: Record<string, string> = {};

function getLogo(filename: string): string {
  if (!LOGO_CACHE[filename]) {
    LOGO_CACHE[filename] = loadLogoBase64(filename);
  }
  return LOGO_CACHE[filename];
}

// ============================================================
// Template config per brand
// ============================================================
interface TemplateTheme {
  cssFile: string;
  logoFile: string;
}

const THEMES: Record<BrandTemplateId, TemplateTheme> = {
  feilong: {
    cssFile: "invoice.css",
    logoFile: "logo.png",
  },
  starlight: {
    cssFile: "starlight.css",
    logoFile: "starlight-logo.png",
  },
};

// ============================================================
// HTML helpers
// ============================================================
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** CNY 货币符号 (U+00A5) — 顾问账单不含税备注按币种区分加税费率时使用 */
const CNY_SYMBOL = "¥";

/**
 * Notes 文本根据含税模式与币种动态生成
 * 含税 (tax_included)  → 上述报价含税, 可开具增值税专用发票
 * 不含税 (tax_excluded) → 加税开票附加费按币种区分: 人民币 6%, 其他币种 12%
 */
function getTaxNote(invoice: Invoice): string {
  // Per spec req 5 (顾问/Consultant 账单备注):
  //   含税   (tax_included)                            → 上述报价含税, 可开具增值税专用发票
  //   不含税 (tax_excluded) + Display Currency = CNY  → 加收 6% 费用
  //   不含税 (tax_excluded) + Display Currency ≠ CNY  → 加收 12% 费用
  //
  // When Display Currency is not explicitly chosen ("原始 / Original"),
  // fall back to the rendered currency symbol so the rule still applies
  // (¥ → 6%; anything else → 12%).
  if (invoice.tax_mode === "tax_included") {
    return "上述报价含税,可开具增值税专用发票。";
  }
  const isCny = invoice.display_currency
    ? invoice.display_currency.toUpperCase() === "CNY"
    : invoice.currency === CNY_SYMBOL;
  const surchargePercent = isCny ? 6 : 12;
  return `上述报价不含税;如需开票,可加收${surchargePercent}%费用开具增值税普通发票或专用发票。`;
}

function formatAmount(n: number, currency: string = "¥"): string {
  return `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a fraction in [0, 1] as a percent string. 0.5 → "50%". Uses up to
 * 2 decimals; trailing zeros stripped.
 */
function formatRatioPercent(fraction: number): string {
  const pct = fraction * 100;
  const rounded = Math.round(pct * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toString()}%`;
}

/**
 * Render the optional installment-payment block shown below Grand Total
 * for consultant invoices (per spec req 4). Returns "" when the invoice
 * has no installment_info attached.
 */
function buildInstallmentHtml(invoice: Invoice): string {
  const info = invoice.installment_info;
  if (!info) return "";
  const c = invoice.currency || "¥";
  const firstPct = formatRatioPercent(info.first_payment_ratio);
  const finalPct = formatRatioPercent(info.final_payment_ratio);
  const firstAmt = formatAmount(info.first_payment_amount, c);
  const finalAmt = formatAmount(info.final_payment_amount, c);
  const days = info.final_payment_business_days;
  const zhText = `分期付款： 首款：服务费的${firstPct}，即金额${firstAmt}，于服务启动之前支付； 尾款：服务费的${finalPct}，即金额${finalAmt}，于服务完成之后的${days}个工作日内支付。`;
  const enText = `Installment Payment: First payment: ${firstPct} of the service fee, i.e., ${firstAmt}, payable before the service commences. Final payment: ${finalPct} of the service fee, i.e., ${finalAmt}, payable within ${days} business days after the service is completed.`;
  return `
    <div class="installment-block">
      <div class="installment-zh">${escapeHtml(zhText)}</div>
      <div class="installment-en">${escapeHtml(enText)}</div>
    </div>`;
}

// ============================================================
// Main render function
// ============================================================
export async function renderByTemplate(
  templateId: BrandTemplateId,
  invoice: Invoice,
  config: CompanyConfig,
  bankAccount: BankAccount,
): Promise<string> {
  if (invoice.invoice_type === "final_payment") {
    return renderFinalPaymentHtml(templateId, invoice, config, bankAccount);
  }

  const theme = THEMES[templateId] ?? THEMES.feilong;
  const css = getCss(theme.cssFile);
  const logoDataUri = getLogo(theme.logoFile);

  // Discount column is only shown when at least one line has a non-zero discount.
  const showDiscount = invoice.items.some(
    (it) => (it.discount_percent ?? 0) > 0,
  );

  const itemsHtml = invoice.items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (item) => `
      <tr>
        <td class="text-left">${escapeHtml(item.service)}</td>
        <td>${escapeHtml(item.service_period)}</td>
        <td class="text-right">${formatAmount(item.price, invoice.currency)}</td>
        <td>${item.qty}</td>
        ${
          showDiscount
            ? `<td>${item.discount_percent > 0 ? item.discount_percent + "%" : "-"}</td>`
            : ""
        }
        <td class="text-right">${formatAmount(item.line_total, invoice.currency)}</td>
        <td class="text-left">${escapeHtml(item.chinese_translation)}</td>
        <td class="text-left">${escapeHtml(item.remark)}</td>
      </tr>`,
    )
    .join("\n");

  // Totals section differs by tax mode
  const totalsHtml = buildTotalsHtml(invoice);

  // Bank info section
  const bankHtml = buildBankHtml(bankAccount);

  // QR code intentionally omitted for consultant invoices (per spec req 6):
  // a stale QR scanned by a client could expose a regenerated amount on a
  // later version of the same invoice no, which is misleading. Final-payment
  // invoices keep the QR (see renderFinalPaymentHtml).
  const qrDataUri = "";

  const brandLabel =
    templateId === "starlight"
      ? "Starlight Business Consulting"
      : "Feilong Business Service";
  const isDraft = invoice.status === "draft";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${escapeHtml(invoice.invoice_no)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="invoice-page">
    ${isDraft ? `<div class="draft-watermark">DRAFT</div>` : ""}
    <!-- Header: Company Info + Logo -->
    <div class="invoice-header">
      <div class="company-info">
        <div class="company-name">${escapeHtml(config.name)}</div>
        <div class="company-address">${escapeHtml(config.address_line1)}</div>
        <div class="company-address">${escapeHtml(config.address_line2)}</div>
        ${config.address_line3 ? `<div class="company-address">${escapeHtml(config.address_line3)}</div>` : ""}
        <div class="company-email">${escapeHtml(config.email)}</div>
      </div>
      ${
        logoDataUri
          ? `<div class="company-logo"><img src="${logoDataUri}" alt="Logo" /></div>`
          : config.logo_url
            ? `<div class="company-logo"><img src="${escapeHtml(config.logo_url)}" alt="Logo" /></div>`
            : ""
      }
    </div>

    <!-- Invoice Meta: Bill To + Badges -->
    <div class="invoice-meta">
      <div class="bill-to">
        <div class="bill-to-label">BILL TO</div>
        <div class="bill-to-value">${[invoice.company_name, invoice.bill_to]
          .map((v) => (v ?? "").trim())
          .filter((v, i, a) => v && a.indexOf(v) === i)
          .map((v) => escapeHtml(v))
          .join("<br/>")}</div>
      </div>
      <div class="invoice-badges">
        <div class="badge">
          <span class="badge-label">INVOICE</span>
          <span class="badge-value">${escapeHtml(invoice.invoice_no)}</span>
        </div>
        <div class="badge">
          <span class="badge-label">DATE</span>
          <span class="badge-value">${escapeHtml(invoice.invoice_date)}</span>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="invoice-table">
      <thead>
        <tr>
          <th>服务内容<span class="th-en">Service</span></th>
          <th>服务期限<span class="th-en">Service Period</span></th>
          <th>价格<span class="th-en">Price</span></th>
          <th>数量<span class="th-en">Qty</span></th>
          ${showDiscount ? `<th>折扣(%)<span class="th-en">Discount(%)</span></th>` : ""}
          <th>合计<span class="th-en">Total</span></th>
          <th>中文翻译<span class="th-en">Chinese Translation</span></th>
          <th>备注<span class="th-en">Note</span></th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    ${totalsHtml}

    <!-- Installment payment block (per spec req 4 — consultant only, when opted in) -->
    ${buildInstallmentHtml(invoice)}

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="notes-label">Notes:</div>
      <div class="tax-note">${escapeHtml(getTaxNote(invoice))}</div>
      ${bankHtml}
    </div>
    ${
      qrDataUri
        ? `<div class="qr-block"><img src="${qrDataUri}" alt="QR" /><div class="qr-label">Scan to view online</div></div>`
        : ""
    }
    <div class="generated-by">
      Generated by ${escapeHtml(brandLabel)} · ${escapeHtml(invoice.invoice_no)} · ${escapeHtml(invoice.invoice_date)}
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// Totals section builder
// ============================================================
function buildTotalsHtml(invoice: Invoice): string {
  const c = invoice.currency;

  if (invoice.invoice_type === "final_payment") {
    const rows: string[] = [];
    rows.push(`
        <tr>
          <td class="label">Actual Amount (Subtotal)</td>
          <td class="value">${formatAmount(invoice.subtotal, c)}</td>
        </tr>`);
    if (typeof invoice.amount_paid_total === "number") {
      rows.push(`
        <tr>
          <td class="label">Less: Amount Paid</td>
          <td class="value">−${formatAmount(invoice.amount_paid_total, c)}</td>
        </tr>`);
    }
    if (typeof invoice.total_deduction_amount === "number") {
      rows.push(`
        <tr>
          <td class="label">Less: Total Deduction</td>
          <td class="value">−${formatAmount(invoice.total_deduction_amount, c)}</td>
        </tr>`);
    }
    if (typeof invoice.amount_refunded === "number") {
      rows.push(`
        <tr>
          <td class="label">Add: Amount Refunded</td>
          <td class="value">+${formatAmount(invoice.amount_refunded, c)}</td>
        </tr>`);
    }
    rows.push(`
        <tr class="grand-total">
          <td class="label">Grand Total (Final Payment)</td>
          <td class="value">${formatAmount(invoice.grand_total, c)}</td>
        </tr>`);
    return `
    <div class="totals-section">
      <table class="totals-table">
        ${rows.join("\n")}
      </table>
    </div>`;
  }

  if (invoice.invoice_type === "consultant") {
    const rows: string[] = [];
    rows.push(`
        <tr>
          <td class="label">Total</td>
          <td class="value">${formatAmount(invoice.subtotal, c)}</td>
        </tr>`);
    // VAT row appears only when rate > 0 (i.e. tax_mode = tax_included).
    if (invoice.vat_rate > 0) {
      rows.push(`
        <tr>
          <td class="label">ADD: VAT(${invoice.vat_rate}%)</td>
          <td class="value">+${formatAmount(invoice.vat_amount, c)}</td>
        </tr>`);
    }
    // EWT row only for Starlight (feilong 菲龙咨询 skips EWT entirely).
    if ((invoice.ewt_rate ?? 0) > 0) {
      rows.push(`
        <tr>
          <td class="label">Less: EWT(${invoice.ewt_rate}%)</td>
          <td class="value">−${formatAmount(invoice.ewt_amount ?? 0, c)}</td>
        </tr>`);
    }
    rows.push(`
        <tr class="grand-total">
          <td class="label">Grand Total</td>
          <td class="value">${formatAmount(invoice.grand_total, c)}</td>
        </tr>`);
    return `
    <div class="totals-section">
      <table class="totals-table">
        ${rows.join("\n")}
      </table>
    </div>`;
  }

  // Legacy fallback (tax_mode-based)
  if (invoice.tax_mode === "tax_included") {
    return `
    <div class="totals-section">
      <table class="totals-table">
        <tr class="grand-total">
          <td class="label">Grand Total</td>
          <td class="value">${formatAmount(invoice.grand_total, c)}</td>
        </tr>
      </table>
    </div>`;
  }

  return `
    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td class="label">Total:</td>
          <td class="value">${formatAmount(invoice.subtotal, c)}</td>
        </tr>
        ${
          invoice.vat_rate > 0
            ? `
        <tr>
          <td class="label">ADD: VAT(${invoice.vat_rate}%)</td>
          <td class="value">${formatAmount(invoice.vat_amount, c)}</td>
        </tr>`
            : ""
        }
        <tr class="grand-total">
          <td class="label">Grand Total${invoice.vat_rate > 0 ? "" : ":"}</td>
          <td class="value">${formatAmount(invoice.grand_total, c)}</td>
        </tr>
      </table>
    </div>`;
}

// ============================================================
// Bank info builder
// ============================================================
function buildBankHtml(bank: BankAccount): string {
  const lines: string[] = [];

  lines.push(`<div class="bank-info">`);
  lines.push(
    `  <div class="bank-info-title">${escapeHtml(bank.payment_title)}</div>`,
  );
  lines.push(
    `  <div class="bank-info-row"><span>Bank Name:</span> ${escapeHtml(bank.bank_name)}</div>`,
  );

  if (bank.bank_address) {
    lines.push(
      `  <div class="bank-info-row"><span>Bank Address:</span> ${escapeHtml(bank.bank_address)}</div>`,
    );
  }

  lines.push(
    `  <div class="bank-info-row"><span>Account Name:</span> ${escapeHtml(bank.account_name)}</div>`,
  );
  lines.push(
    `  <div class="bank-info-row"><span>Account Number:</span> ${escapeHtml(bank.account_number)}</div>`,
  );

  if (bank.currency_label) {
    lines.push(
      `  <div class="bank-info-row"><span>Currency:</span> ${escapeHtml(bank.currency_label)}</div>`,
    );
  }

  if (bank.swift_code) {
    lines.push(
      `  <div class="bank-info-row"><span>Swift Code/ BIC:</span> ${escapeHtml(bank.swift_code)}</div>`,
    );
  }

  lines.push(`</div>`);
  return lines.join("\n");
}

// ============================================================
// Final-payment (尾款账单) template — distinct layout per spec:
//   最终账单插件需求.docx §三.
// ============================================================
async function renderFinalPaymentHtml(
  templateId: BrandTemplateId,
  invoice: Invoice,
  config: CompanyConfig,
  bankAccount: BankAccount,
): Promise<string> {
  const theme = THEMES[templateId] ?? THEMES.feilong;
  const css = getCss(theme.cssFile);
  const logoDataUri = getLogo(theme.logoFile);
  const c = invoice.currency;

  const itemsHtml = invoice.items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.bill_number ?? "")}</td>
        <td>${escapeHtml(item.billing_date || invoice.invoice_date || "")}</td>
        <td class="text-left">${escapeHtml(item.service)}</td>
        <td class="text-right">${formatAmount(item.amount_billed ?? 0, c)}</td>
        <td class="text-right">${formatAmount(item.actual_amount_incurred ?? 0, c)}</td>
        <td class="text-right">${formatAmount(item.amount_paid ?? 0, c)}</td>
        <td class="text-right">${formatAmount(item.balance ?? 0, c)}</td>
        <td class="text-left">${escapeHtml(item.note ?? item.remark ?? "")}</td>
      </tr>`,
    )
    .join("\n");

  const sum = (key: keyof typeof invoice.items[number]): number =>
    invoice.items.reduce((s, it) => s + (((it as unknown) as Record<string, number>)[key as string] ?? 0), 0);
  const billedSum = sum("amount_billed");
  const actualSum = sum("actual_amount_incurred");
  const paidSum = sum("amount_paid");
  const balanceSum = sum("balance");

  const totalsRows: string[] = [];
  totalsRows.push(`
        <tr>
          <td class="label">Total Balance</td>
          <td class="value">${formatAmount(invoice.total_balance ?? balanceSum, c)}</td>
        </tr>`);
  if ((invoice.amount_refunded ?? 0) > 0) {
    totalsRows.push(`
        <tr>
          <td class="label">Amount Refunded</td>
          <td class="value">${formatAmount(invoice.amount_refunded ?? 0, c)}</td>
        </tr>`);
  }
  // Deductible Amount intentionally hidden per 2026-05 spec update.
  totalsRows.push(`
        <tr class="grand-total">
          <td class="label">Final Balance</td>
          <td class="value">${formatAmount(invoice.final_balance ?? invoice.grand_total, c)}</td>
        </tr>`);

  const clientName = invoice.client_name ?? invoice.bill_to;
  const clientCompany = invoice.client_company ?? invoice.company_name;
  const qrDataUri = invoice.html_url
    ? await renderQrDataUri(invoice.html_url)
    : "";
  const brandLabel =
    templateId === "starlight"
      ? "Starlight Business Consulting"
      : "Feilong Business Service";
  const isDraft = invoice.status === "draft";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Final Billing Invoice ${escapeHtml(invoice.invoice_no)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="invoice-page">
    ${isDraft ? `<div class="draft-watermark">DRAFT</div>` : ""}
    <div class="invoice-header">
      <div class="company-info">
        <div class="company-name">${escapeHtml(config.name)}</div>
        <div class="company-address">${escapeHtml(config.address_line1)}</div>
        <div class="company-address">${escapeHtml(config.address_line2)}</div>
        ${config.address_line3 ? `<div class="company-address">${escapeHtml(config.address_line3)}</div>` : ""}
        <div class="company-email">${escapeHtml(config.email)}</div>
      </div>
      ${
        logoDataUri
          ? `<div class="company-logo"><img src="${logoDataUri}" alt="Logo" /></div>`
          : ""
      }
    </div>

    <h2 style="text-align:center;margin:16px 0 20px;">Final Billing Invoice</h2>

    <div class="invoice-meta" style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div class="bill-to">
        <div><strong>Client Name:</strong> ${escapeHtml(clientName)}</div>
        <div><strong>Client Company:</strong> ${escapeHtml(clientCompany)}</div>
      </div>
      <div class="invoice-badges">
        <div class="badge">
          <span class="badge-label">DATE</span>
          <span class="badge-value">${escapeHtml(invoice.invoice_date)}</span>
        </div>
        <div class="badge">
          <span class="badge-label">BILLING No.</span>
          <span class="badge-value">${escapeHtml(invoice.invoice_no)}</span>
        </div>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Bill Number</th>
          <th>Date</th>
          <th>Product/Service</th>
          <th>Amount Billed</th>
          <th>Actual Amount Incurred</th>
          <th>Amount Paid</th>
          <th>Balance</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="grand-total">
          <td colspan="3" class="text-right">Grand Total</td>
          <td class="text-right">${formatAmount(billedSum, c)}</td>
          <td class="text-right">${formatAmount(actualSum, c)}</td>
          <td class="text-right">${formatAmount(paidSum, c)}</td>
          <td class="text-right">${formatAmount(balanceSum, c)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        ${totalsRows.join("\n")}
      </table>
    </div>

    <div class="invoice-footer">
      ${buildBankHtml(bankAccount)}
    </div>
    ${
      qrDataUri
        ? `<div class="qr-block"><img src="${qrDataUri}" alt="QR" /><div class="qr-label">Scan to view online</div></div>`
        : ""
    }
    <div class="generated-by">
      Generated by ${escapeHtml(brandLabel)} · ${escapeHtml(invoice.invoice_no)} · ${escapeHtml(invoice.invoice_date)}
    </div>
  </div>
</body>
</html>`;
}

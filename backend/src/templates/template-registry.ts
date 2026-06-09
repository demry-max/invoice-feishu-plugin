import fs from "fs";
import path from "path";
import type {
  Invoice,
  CompanyConfig,
  BankAccount,
  BrandTemplateId,
  TaxMode,
} from "../types";

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

/**
 * Notes 文本根据含税模式动态生成
 * 用户选择"不含税"→ tax_included → 不含税 note
 * 用户选择"含税 (+VAT)"→ tax_excluded → 含税 note
 */
function getTaxNote(taxMode: TaxMode): string {
  // New semantics (per 账单调整需求 Copy.docx):
  //   tax_excluded (不含税) → "上述报价不含税;如需开票…"
  //   tax_included (含税)   → "上述报价含税,可开具增值税专用发票。"
  if (taxMode === "tax_included") {
    return "上述报价含税,可开具增值税专用发票。";
  }
  return "注:上述报价不含税;如需开票,可加收1%费用开具增值税普通发票,或加收3%费用开具增值税专用发票。";
}

function formatAmount(n: number, currency: string = "¥"): string {
  return `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================
// Main render function
// ============================================================
export function renderByTemplate(
  templateId: BrandTemplateId,
  invoice: Invoice,
  config: CompanyConfig,
  bankAccount: BankAccount,
): string {
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

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="notes-label">Notes:</div>
      <div class="tax-note">${escapeHtml(getTaxNote(invoice.tax_mode))}</div>
      ${bankHtml}
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
function renderFinalPaymentHtml(
  templateId: BrandTemplateId,
  invoice: Invoice,
  config: CompanyConfig,
  bankAccount: BankAccount,
): string {
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
  if ((invoice.total_deduction_amount ?? 0) > 0) {
    totalsRows.push(`
        <tr>
          <td class="label">Deductible Amount</td>
          <td class="value">${formatAmount(invoice.total_deduction_amount ?? 0, c)}</td>
        </tr>`);
  }
  totalsRows.push(`
        <tr class="grand-total">
          <td class="label">Final Balance</td>
          <td class="value">${formatAmount(invoice.final_balance ?? invoice.grand_total, c)}</td>
        </tr>`);

  const clientName = invoice.client_name ?? invoice.bill_to;
  const clientCompany = invoice.client_company ?? invoice.company_name;

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
  </div>
</body>
</html>`;
}

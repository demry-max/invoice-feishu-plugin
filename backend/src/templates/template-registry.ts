import fs from 'fs';
import path from 'path';
import type { Invoice, CompanyConfig, BankAccount, BrandTemplateId } from '../types';

// ============================================================
// CSS cache
// ============================================================
function loadCss(filename: string): string {
  return fs.readFileSync(path.join(__dirname, filename), 'utf-8');
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
  const logoPath = path.resolve(__dirname, '../../../', filename);
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    return '';
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
    cssFile: 'invoice.css',
    logoFile: 'logo.png',
  },
  starlight: {
    cssFile: 'starlight.css',
    logoFile: 'starlight-logo.png',
  },
};

// ============================================================
// HTML helpers
// ============================================================
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(n: number, currency: string = '¥'): string {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const theme = THEMES[templateId] ?? THEMES.feilong;
  const css = getCss(theme.cssFile);
  const logoDataUri = getLogo(theme.logoFile);

  const itemsHtml = invoice.items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (item) => `
      <tr>
        <td class="text-left">${escapeHtml(item.service)}</td>
        <td>${escapeHtml(item.service_period)}</td>
        <td class="text-right">${formatAmount(item.price, invoice.currency)}</td>
        <td>${item.qty}</td>
        <td>${item.discount_percent > 0 ? item.discount_percent + '%' : '-'}</td>
        <td class="text-right">${formatAmount(item.line_total, invoice.currency)}</td>
        <td class="text-left">${escapeHtml(item.chinese_translation)}</td>
        <td class="text-left">${escapeHtml(item.remark)}</td>
      </tr>`,
    )
    .join('\n');

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
        <div class="company-email">${escapeHtml(config.email)}</div>
      </div>
      ${
        logoDataUri
          ? `<div class="company-logo"><img src="${logoDataUri}" alt="Logo" /></div>`
          : config.logo_url
            ? `<div class="company-logo"><img src="${escapeHtml(config.logo_url)}" alt="Logo" /></div>`
            : ''
      }
    </div>

    <!-- Invoice Meta: Bill To + Badges -->
    <div class="invoice-meta">
      <div class="bill-to">
        <div class="bill-to-label">BILL TO</div>
        <div class="bill-to-value">${escapeHtml(invoice.bill_to)}</div>
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
          <th>折扣(%)<span class="th-en">Discount(%)</span></th>
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
      <div class="tax-note">${escapeHtml(config.tax_note || config.name)}</div>
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

  if (invoice.tax_mode === 'tax_included') {
    // 含税模式: Grand Total 就是行合计之和，VAT 是包含在内的
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

  // 不含税模式 (default): Total + VAT = Grand Total
  return `
    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td class="label">Total:</td>
          <td class="value">${formatAmount(invoice.subtotal, c)}</td>
        </tr>
        ${invoice.vat_rate > 0 ? `
        <tr>
          <td class="label">ADD: VAT(${invoice.vat_rate}%)</td>
          <td class="value">${formatAmount(invoice.vat_amount, c)}</td>
        </tr>` : ''}
        <tr class="grand-total">
          <td class="label">Grand Total${invoice.vat_rate > 0 ? '' : ':'}</td>
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
  lines.push(`  <div class="bank-info-title">${escapeHtml(bank.payment_title)}</div>`);
  lines.push(`  <div class="bank-info-row"><span>Bank Name:</span> ${escapeHtml(bank.bank_name)}</div>`);

  if (bank.bank_address) {
    lines.push(`  <div class="bank-info-row"><span>Bank Address:</span> ${escapeHtml(bank.bank_address)}</div>`);
  }

  lines.push(`  <div class="bank-info-row"><span>Account Name:</span> ${escapeHtml(bank.account_name)}</div>`);
  lines.push(`  <div class="bank-info-row"><span>Account Number:</span> ${escapeHtml(bank.account_number)}</div>`);

  if (bank.currency_label) {
    lines.push(`  <div class="bank-info-row"><span>Currency:</span> ${escapeHtml(bank.currency_label)}</div>`);
  }

  if (bank.swift_code) {
    lines.push(`  <div class="bank-info-row"><span>Swift Code/ BIC:</span> ${escapeHtml(bank.swift_code)}</div>`);
  }

  lines.push(`</div>`);
  return lines.join('\n');
}

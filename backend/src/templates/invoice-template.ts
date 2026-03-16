import fs from 'fs';
import path from 'path';
import type { Invoice, CompanyConfig } from '../types';

const cssContent = fs.readFileSync(path.join(__dirname, 'invoice.css'), 'utf-8');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(n: number, currency: string = '¥'): string {
  return `${currency}${n.toFixed(2)}`;
}

export function renderInvoiceHtml(invoice: Invoice, config: CompanyConfig): string {
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
      </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${escapeHtml(invoice.invoice_no)}</title>
  <style>${cssContent}</style>
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
        config.logo_url
          ? `<div class="company-logo"><img src="${escapeHtml(config.logo_url)}" alt="Logo" /></div>`
          : ''
      }
    </div>

    <!-- Invoice Meta: Bill To + Red Badges -->
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
          <th>备注<span class="th-en">Remark</span></th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td class="label">Total</td>
          <td class="value">${formatAmount(invoice.subtotal, invoice.currency)}</td>
        </tr>
        <tr>
          <td class="label">ADD: VAT(${invoice.vat_rate}%)</td>
          <td class="value">${formatAmount(invoice.vat_amount, invoice.currency)}</td>
        </tr>
        <tr class="grand-total">
          <td class="label">Grand Total</td>
          <td class="value">${formatAmount(invoice.grand_total, invoice.currency)}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="tax-note">${escapeHtml(config.tax_note)}</div>
      <div class="bank-info">
        <div class="bank-info-title">${escapeHtml(config.bank_payment_title)}</div>
        <div class="bank-info-row"><span>户名:</span> ${escapeHtml(config.bank_account_name)}</div>
        <div class="bank-info-row"><span>账号:</span> ${escapeHtml(config.bank_account_number)}</div>
        <div class="bank-info-row"><span>开户银行:</span> ${escapeHtml(config.bank_name)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

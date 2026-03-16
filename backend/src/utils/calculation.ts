import type { SourceItem, InvoiceItem } from '../types';

const DEFAULT_VAT_RATE = 6;

/** 计算单行合计: price * qty * (1 - discount / 100) */
export function calcLineTotal(price: number, qty: number, discountPercent: number): number {
  const q = Math.max(qty, 1);
  const d = discountPercent || 0;
  return round2(price * q * (1 - d / 100));
}

/** 将 SourceItem 列表转换为 InvoiceItem 列表 */
export function buildInvoiceItems(sources: SourceItem[], invoiceNo: string): InvoiceItem[] {
  return sources.map((s, idx) => ({
    invoice_no: invoiceNo,
    service: s.service,
    service_period: s.service_period,
    price: s.price,
    qty: Math.max(s.qty, 1),
    discount_percent: s.discount_percent || 0,
    line_total: calcLineTotal(s.price, s.qty, s.discount_percent),
    chinese_translation: s.chinese_translation || '',
    remark: s.remark || '',
    sort_order: idx + 1,
  }));
}

/** 计算 subtotal */
export function calcSubtotal(items: InvoiceItem[]): number {
  return round2(items.reduce((sum, it) => sum + it.line_total, 0));
}

/** 计算 VAT */
export function calcVat(subtotal: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return round2(subtotal * vatRate / 100);
}

/** 计算 Grand Total */
export function calcGrandTotal(subtotal: number, vat: number): number {
  return round2(subtotal + vat);
}

/** 保留两位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 格式化金额 */
export function formatAmount(n: number, currency: string = '¥'): string {
  return `${currency}${n.toFixed(2)}`;
}

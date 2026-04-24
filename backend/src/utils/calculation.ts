import type {
  SourceItem,
  InvoiceItem,
  InvoiceType,
  VatRatePercent,
} from "../types";

const DEFAULT_VAT_RATE = 6;
const EWT_RATE = 2;

/** 计算单行合计: price * qty * (1 - discount / 100) */
export function calcLineTotal(
  price: number,
  qty: number,
  discountPercent: number,
): number {
  const q = Math.max(qty, 1);
  const d = discountPercent || 0;
  return round2(price * q * (1 - d / 100));
}

/**
 * 将 SourceItem 列表转换为 InvoiceItem 列表
 * 对 final_payment 类型：line_total 基于 actual_amount_incurred；
 * 也可按 exchangeRate 对 price / actual_amount 统一换算到展示币种。
 */
export function buildInvoiceItems(
  sources: SourceItem[],
  invoiceNo: string,
  opts: {
    invoiceType?: InvoiceType;
    exchangeRate?: number; // multiply source amount by this to get display amount
  } = {},
): InvoiceItem[] {
  const { invoiceType = "consultant", exchangeRate = 1 } = opts;
  return sources.map((s, idx) => {
    const displayPrice = round2((s.price || 0) * exchangeRate);
    const qty = Math.max(s.qty, 1);
    const discount = s.discount_percent || 0;

    let lineTotal: number;
    if (invoiceType === "final_payment") {
      // Final payment uses actual_amount_incurred when provided, else price×qty
      const actual = (s.actual_amount_incurred ?? 0) * exchangeRate;
      lineTotal = round2(actual > 0 ? actual : displayPrice * qty * (1 - discount / 100));
    } else {
      lineTotal = calcLineTotal(displayPrice, qty, discount);
    }

    return {
      invoice_no: invoiceNo,
      service: s.service,
      service_period: s.service_period,
      price: displayPrice,
      qty,
      discount_percent: discount,
      line_total: lineTotal,
      chinese_translation: s.chinese_translation || "",
      remark: s.remark || "",
      sort_order: idx + 1,
      tax_eligible: !!s.tax_eligible,
      actual_amount_incurred: s.actual_amount_incurred
        ? round2((s.actual_amount_incurred || 0) * exchangeRate)
        : undefined,
      amount_paid: s.amount_paid
        ? round2((s.amount_paid || 0) * exchangeRate)
        : undefined,
    };
  });
}

/** 计算 subtotal — 所有行 line_total 求和 */
export function calcSubtotal(items: InvoiceItem[]): number {
  return round2(items.reduce((sum, it) => sum + it.line_total, 0));
}

/** 顾问账单的应税小计 (tax_eligible = true 行 line_total 求和) */
export function calcTaxableSubtotal(items: InvoiceItem[]): number {
  return round2(
    items
      .filter((it) => it.tax_eligible)
      .reduce((sum, it) => sum + it.line_total, 0),
  );
}

/** 计算 VAT (按应税小计与 VAT 比例) */
export function calcVat(
  taxableSubtotal: number,
  vatRatePercent: number = DEFAULT_VAT_RATE,
): number {
  return round2((taxableSubtotal * vatRatePercent) / 100);
}

/**
 * 计算 EWT 预扣税。默认 2%，但允许调用方显式传 0 (e.g. 菲龙咨询 never charges EWT).
 */
export function calcEwt(
  taxableSubtotal: number,
  ewtRatePercent: number = EWT_RATE,
): number {
  return round2((taxableSubtotal * ewtRatePercent) / 100);
}

/** 顾问账单合计: subtotal + VAT − EWT */
export function calcConsultantGrandTotal(
  subtotal: number,
  vatAmount: number,
  ewtAmount: number,
): number {
  return round2(subtotal + vatAmount - ewtAmount);
}

/**
 * 尾款账单合计: Σ(Actual Amount Incurred) − Σ(Amount Paid)
 *              − Total Deduction Amount + Amount Refunded
 * 注：subtotal 在 final_payment 模式下已经是 Σ(Actual Amount Incurred) 换算后的值
 */
export function calcFinalPaymentGrandTotal(
  subtotal: number,
  amountPaidTotal: number,
  totalDeductionAmount: number,
  amountRefunded: number,
): number {
  return round2(subtotal - amountPaidTotal - totalDeductionAmount + amountRefunded);
}

/** 旧 API — 保留向后兼容（纯 subtotal + vat） */
export function calcGrandTotal(subtotal: number, vat: number): number {
  return round2(subtotal + vat);
}

/** 从 SourceItem 列表提取 amount_paid / refunded / deduction 的合并值 */
export function aggregateFinalPaymentContext(sources: SourceItem[]): {
  amountPaidTotal: number;
  amountRefunded: number;
  totalDeductionAmount: number;
} {
  const amountPaidTotal = round2(
    sources.reduce((sum, s) => sum + (s.amount_paid || 0), 0),
  );
  // Refund + deduction are main-record-level; first non-empty wins
  const amountRefunded = round2(
    sources.find((s) => (s.amount_refunded ?? 0) !== 0)?.amount_refunded ?? 0,
  );
  const totalDeductionAmount = round2(
    sources.find((s) => (s.total_deduction_amount ?? 0) !== 0)
      ?.total_deduction_amount ?? 0,
  );
  return { amountPaidTotal, amountRefunded, totalDeductionAmount };
}

/** 保留两位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 格式化金额 */
export function formatAmount(n: number, currency: string = "¥"): string {
  return `${currency}${n.toFixed(2)}`;
}

export { DEFAULT_VAT_RATE, EWT_RATE };

export type { InvoiceType, VatRatePercent };

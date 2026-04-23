import React from "react";
import type { PreviewResponse } from "../types";
import { formatAmount } from "../utils/format";

interface Props {
  preview: PreviewResponse | null;
  currency: string;
}

export const TotalsSummary: React.FC<Props> = ({ preview, currency }) => {
  if (!preview) return null;

  const cur = preview.display_currency
    ? currencySymbol(preview.display_currency)
    : currency;

  if (preview.invoice_type === "final_payment") {
    return (
      <div className="totals-summary">
        <div className="totals-row">
          <span className="totals-label">Actual Amount (小计)</span>
          <span className="totals-value">
            {formatAmount(preview.subtotal, cur)}
          </span>
        </div>
        {typeof preview.amount_paid_total === "number" && (
          <div className="totals-row">
            <span className="totals-label">Less: Amount Paid</span>
            <span className="totals-value">
              −{formatAmount(preview.amount_paid_total, cur)}
            </span>
          </div>
        )}
        {typeof preview.total_deduction_amount === "number" && (
          <div className="totals-row">
            <span className="totals-label">Less: Total Deduction</span>
            <span className="totals-value">
              −{formatAmount(preview.total_deduction_amount, cur)}
            </span>
          </div>
        )}
        {typeof preview.amount_refunded === "number" && (
          <div className="totals-row">
            <span className="totals-label">Add: Amount Refunded</span>
            <span className="totals-value">
              +{formatAmount(preview.amount_refunded, cur)}
            </span>
          </div>
        )}
        <div className="totals-row grand-total">
          <span className="totals-label">Grand Total (尾款)</span>
          <span className="totals-value">
            {formatAmount(preview.grand_total, cur)}
          </span>
        </div>
      </div>
    );
  }

  // Consultant invoice (with tax_eligible, VAT, EWT)
  if (preview.invoice_type === "consultant") {
    return (
      <div className="totals-summary">
        <div className="totals-row">
          <span className="totals-label">Total (subtotal)</span>
          <span className="totals-value">
            {formatAmount(preview.subtotal, cur)}
          </span>
        </div>
        {typeof preview.taxable_subtotal === "number" && (
          <div className="totals-row" style={{ fontSize: "12px", color: "#999" }}>
            <span className="totals-label">Taxable subtotal</span>
            <span className="totals-value">
              {formatAmount(preview.taxable_subtotal, cur)}
            </span>
          </div>
        )}
        <div className="totals-row">
          <span className="totals-label">ADD: VAT({preview.vat_rate}%)</span>
          <span className="totals-value">
            +{formatAmount(preview.vat_amount, cur)}
          </span>
        </div>
        <div className="totals-row">
          <span className="totals-label">
            Less: EWT({preview.ewt_rate ?? 2}%)
          </span>
          <span className="totals-value">
            −{formatAmount(preview.ewt_amount ?? 0, cur)}
          </span>
        </div>
        <div className="totals-row grand-total">
          <span className="totals-label">Grand Total</span>
          <span className="totals-value">
            {formatAmount(preview.grand_total, cur)}
          </span>
        </div>
      </div>
    );
  }

  // Legacy (no invoice_type): old tax_mode behavior
  const isTaxIncluded = preview.tax_mode === "tax_included";
  return (
    <div className="totals-summary">
      {isTaxIncluded ? (
        <>
          <div className="totals-row grand-total">
            <span className="totals-label">Grand Total (含税)</span>
            <span className="totals-value">
              {formatAmount(preview.grand_total, cur)}
            </span>
          </div>
          <div className="totals-row" style={{ fontSize: "12px", color: "#999" }}>
            <span className="totals-label">其中 VAT({preview.vat_rate}%)</span>
            <span className="totals-value">
              {formatAmount(preview.vat_amount, cur)}
            </span>
          </div>
          <div className="totals-row" style={{ fontSize: "12px", color: "#999" }}>
            <span className="totals-label">不含税金额</span>
            <span className="totals-value">
              {formatAmount(preview.subtotal, cur)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="totals-row">
            <span className="totals-label">Total</span>
            <span className="totals-value">
              {formatAmount(preview.subtotal, cur)}
            </span>
          </div>
          <div className="totals-row">
            <span className="totals-label">ADD: VAT({preview.vat_rate}%)</span>
            <span className="totals-value">
              {formatAmount(preview.vat_amount, cur)}
            </span>
          </div>
          <div className="totals-row grand-total">
            <span className="totals-label">Grand Total</span>
            <span className="totals-value">
              {formatAmount(preview.grand_total, cur)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

function currencySymbol(code: string): string {
  switch (code.toUpperCase()) {
    case "CNY":
      return "¥";
    case "USD":
      return "$";
    case "PHP":
      return "₱";
    default:
      return code;
  }
}

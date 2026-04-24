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
    const totalBalance = preview.total_balance ?? 0;
    const refunded = preview.amount_refunded ?? 0;
    const deductible = preview.total_deduction_amount ?? 0;
    const finalBalance = preview.final_balance ?? preview.grand_total;
    return (
      <div className="totals-summary">
        <div className="totals-row">
          <span className="totals-label">Total Balance</span>
          <span className="totals-value">{formatAmount(totalBalance, cur)}</span>
        </div>
        {refunded > 0 && (
          <div className="totals-row">
            <span className="totals-label">Amount Refunded</span>
            <span className="totals-value">{formatAmount(refunded, cur)}</span>
          </div>
        )}
        {deductible > 0 && (
          <div className="totals-row">
            <span className="totals-label">Deductible Amount</span>
            <span className="totals-value">{formatAmount(deductible, cur)}</span>
          </div>
        )}
        <div className="totals-row grand-total">
          <span className="totals-label">Final Balance</span>
          <span className="totals-value">{formatAmount(finalBalance, cur)}</span>
        </div>
      </div>
    );
  }

  // Consultant invoice — totals reflect tax_mode + template rules:
  //   tax_excluded (不含税)   → only Total + Grand Total (equal).
  //   tax_included (含税)     → Total + ADD:VAT + [Less:EWT if Starlight] + Grand Total.
  if (preview.invoice_type === "consultant") {
    const showVat = preview.vat_rate > 0;
    const showEwt = (preview.ewt_rate ?? 0) > 0;
    return (
      <div className="totals-summary">
        <div className="totals-row">
          <span className="totals-label">Total</span>
          <span className="totals-value">
            {formatAmount(preview.subtotal, cur)}
          </span>
        </div>
        {showVat && (
          <div className="totals-row">
            <span className="totals-label">ADD: VAT({preview.vat_rate}%)</span>
            <span className="totals-value">
              +{formatAmount(preview.vat_amount, cur)}
            </span>
          </div>
        )}
        {showEwt && (
          <div className="totals-row">
            <span className="totals-label">
              Less: EWT({preview.ewt_rate}%)
            </span>
            <span className="totals-value">
              −{formatAmount(preview.ewt_amount ?? 0, cur)}
            </span>
          </div>
        )}
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

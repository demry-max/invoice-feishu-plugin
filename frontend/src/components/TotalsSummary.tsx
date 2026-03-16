import React from 'react';
import type { PreviewResponse } from '../types';
import { formatAmount } from '../utils/format';

interface Props {
  preview: PreviewResponse | null;
  currency: string;
}

export const TotalsSummary: React.FC<Props> = ({ preview, currency }) => {
  if (!preview) return null;

  return (
    <div className="totals-summary">
      <div className="totals-row">
        <span className="totals-label">Total</span>
        <span className="totals-value">{formatAmount(preview.subtotal, currency)}</span>
      </div>
      <div className="totals-row">
        <span className="totals-label">ADD: VAT({preview.vat_rate}%)</span>
        <span className="totals-value">{formatAmount(preview.vat_amount, currency)}</span>
      </div>
      <div className="totals-row grand-total">
        <span className="totals-label">Grand Total</span>
        <span className="totals-value">{formatAmount(preview.grand_total, currency)}</span>
      </div>
    </div>
  );
};

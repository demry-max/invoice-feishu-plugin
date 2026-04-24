import React from 'react';
import type { SourceItem, InvoiceItem, InvoiceType } from '../types';
import { formatAmount, calcLineTotal } from '../utils/format';

interface Props {
  sourceItems?: SourceItem[];
  invoiceItems?: InvoiceItem[];
  currency: string;
  invoiceType?: InvoiceType;
}

export const ItemsTable: React.FC<Props> = ({
  sourceItems,
  invoiceItems,
  currency,
  invoiceType = "consultant",
}) => {
  if (invoiceType === "final_payment") {
    return (
      <FinalPaymentTable
        sourceItems={sourceItems}
        invoiceItems={invoiceItems}
        currency={currency}
      />
    );
  }
  const rows = invoiceItems
    ? invoiceItems.map((item) => ({
        service: item.service,
        service_period: item.service_period,
        price: item.price,
        qty: item.qty,
        discount_percent: item.discount_percent,
        line_total: item.line_total,
        chinese_translation: item.chinese_translation,
        remark: item.remark,
      }))
    : (sourceItems || []).map((item) => ({
        service: item.service,
        service_period: item.service_period,
        price: item.price,
        qty: Math.max(item.qty, 1),
        discount_percent: item.discount_percent || 0,
        line_total: calcLineTotal(item.price, item.qty, item.discount_percent),
        chinese_translation: item.chinese_translation || '',
        remark: item.remark || '',
      }));

  if (rows.length === 0) {
    return <div className="empty-state">暂无数据，请先加载选中记录</div>;
  }

  const showDiscount = rows.some((r) => (r.discount_percent ?? 0) > 0);

  return (
    <div className="table-wrapper">
      <table className="items-table">
        <thead>
          <tr>
            <th>
              服务内容
              <br />
              <span className="th-en">Service</span>
            </th>
            <th>
              服务期限
              <br />
              <span className="th-en">Service Period</span>
            </th>
            <th>
              价格
              <br />
              <span className="th-en">Price</span>
            </th>
            <th>
              数量
              <br />
              <span className="th-en">Qty</span>
            </th>
            {showDiscount && (
              <th>
                折扣(%)
                <br />
                <span className="th-en">Discount(%)</span>
              </th>
            )}
            <th>
              合计
              <br />
              <span className="th-en">Total</span>
            </th>
            <th>
              中文翻译
              <br />
              <span className="th-en">Chinese Translation</span>
            </th>
            <th>
              备注
              <br />
              <span className="th-en">Remark</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="text-left">{row.service}</td>
              <td>{row.service_period}</td>
              <td className="text-right">{formatAmount(row.price, currency)}</td>
              <td>{row.qty}</td>
              {showDiscount && (
                <td>{row.discount_percent > 0 ? `${row.discount_percent}%` : '-'}</td>
              )}
              <td className="text-right">{formatAmount(row.line_total, currency)}</td>
              <td className="text-left">{row.chinese_translation}</td>
              <td className="text-left">{row.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface FinalPaymentTableProps {
  sourceItems?: SourceItem[];
  invoiceItems?: InvoiceItem[];
  currency: string;
}

const FinalPaymentTable: React.FC<FinalPaymentTableProps> = ({
  sourceItems,
  invoiceItems,
  currency,
}) => {
  const rows = invoiceItems
    ? invoiceItems.map((i) => ({
        bill_number: i.bill_number ?? "",
        billing_date: i.billing_date ?? "",
        service: i.service,
        amount_billed: i.amount_billed ?? 0,
        actual: i.actual_amount_incurred ?? 0,
        paid: i.amount_paid ?? 0,
        balance: i.balance ?? 0,
        note: i.note ?? i.remark ?? "",
      }))
    : (sourceItems || []).map((s) => {
        const actual = s.actual_amount_incurred ?? 0;
        const paid = s.amount_paid ?? 0;
        return {
          bill_number: s.bill_number ?? "",
          billing_date: s.billing_date ?? "",
          service: s.service,
          amount_billed: s.amount_billed ?? s.price ?? 0,
          actual,
          paid,
          balance: Math.round((actual - paid) * 100) / 100,
          note: s.remark ?? "",
        };
      });

  if (rows.length === 0) {
    return <div className="empty-state">暂无数据</div>;
  }

  const sum = (k: "amount_billed" | "actual" | "paid" | "balance"): number =>
    Math.round(rows.reduce((t, r) => t + r[k], 0) * 100) / 100;

  return (
    <div className="table-wrapper">
      <table className="items-table">
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
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.bill_number}</td>
              <td>{r.billing_date}</td>
              <td className="text-left">{r.service}</td>
              <td className="text-right">{formatAmount(r.amount_billed, currency)}</td>
              <td className="text-right">{formatAmount(r.actual, currency)}</td>
              <td className="text-right">{formatAmount(r.paid, currency)}</td>
              <td className="text-right">{formatAmount(r.balance, currency)}</td>
              <td className="text-left">{r.note}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3} className="text-right">Grand Total</td>
            <td className="text-right">{formatAmount(sum("amount_billed"), currency)}</td>
            <td className="text-right">{formatAmount(sum("actual"), currency)}</td>
            <td className="text-right">{formatAmount(sum("paid"), currency)}</td>
            <td className="text-right">{formatAmount(sum("balance"), currency)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

import React from 'react';
import type { SourceItem, InvoiceItem } from '../types';
import { formatAmount, calcLineTotal } from '../utils/format';

interface Props {
  sourceItems?: SourceItem[];
  invoiceItems?: InvoiceItem[];
  currency: string;
}

export const ItemsTable: React.FC<Props> = ({ sourceItems, invoiceItems, currency }) => {
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

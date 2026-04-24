import React from "react";

interface Props {
  billTo: string;
  companyName: string;
  invoiceDate: string;
  onBillToChange: (v: string) => void;
  onCompanyNameChange: (v: string) => void;
  onInvoiceDateChange: (v: string) => void;
}

export const BillToSection: React.FC<Props> = ({
  billTo,
  companyName,
  invoiceDate,
  onBillToChange,
  onCompanyNameChange,
  onInvoiceDateChange,
}) => {
  return (
    <div className="section">
      <h3 className="section-title">客户信息 / Bill To</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Bill To</label>
          <input
            type="text"
            value={billTo}
            onChange={(e) => onBillToChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>公司名称 (发票抬头) / Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>账单日期 / Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => onInvoiceDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

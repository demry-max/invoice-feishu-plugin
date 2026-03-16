import React, { useState, useEffect } from 'react';
import type { CompanyConfig } from './types';
import { useInvoice } from './hooks/useInvoice';
import { CompanyInfoSection } from './components/CompanyInfoSection';
import { BillToSection } from './components/BillToSection';
import { ItemsTable } from './components/ItemsTable';
import { TotalsSummary } from './components/TotalsSummary';
import { ResultSection } from './components/ResultSection';
import './App.css';

const DEFAULT_CONFIG: CompanyConfig = {
  name: 'Feilong Business Service (Shenzhen) Co., Ltd',
  address_line1: '2308B, Building A, Phase 1,',
  address_line2: 'Shenzhen Longgang Bantian Xinghe WORLD',
  email: 'finance@starlight.ph',
  logo_url: '',
  tax_note:
    '注:上述报价不含税；如需开票，可加收1%费用开具增值税普通发票，或加收3%费用开具增值税专用发票。可开具增值税专用发票。',
  bank_payment_title: 'Please Deposit Payment to the Following Bank Account',
  bank_account_name: '菲娱咨询服务（深圳）有限公司',
  bank_account_number: '641971264',
  bank_name: '民生银行深圳分行营业部',
};

const App: React.FC = () => {
  const {
    sourceItems,
    preview,
    result,
    loading,
    error,
    loadSourceItems,
    doPreview,
    doGenerate,
    clearResult,
  } = useInvoice();

  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(DEFAULT_CONFIG);
  const [billTo, setBillTo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('¥');
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);

  // 从源数据自动填充 bill_to 和 company_name
  useEffect(() => {
    if (sourceItems.length > 0) {
      const first = sourceItems[0];
      if (!billTo && first.bill_to) setBillTo(first.bill_to);
      if (!companyName && first.company_name) setCompanyName(first.company_name);
      if (first.currency) setCurrency(first.currency);
    }
  }, [sourceItems]);

  const handlePreview = () => {
    doPreview(companyConfig, billTo, currency);
  };

  const handleGenerate = () => {
    if (!billTo.trim()) {
      alert('请填写 Bill To');
      return;
    }
    doGenerate(billTo, companyName || companyConfig.name, companyConfig, invoiceDate, currency);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Invoice Generator</h1>
        <p className="subtitle">飞书多维表格账单生成插件</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* 加载记录 */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">选中记录 / Selected Records</h3>
          <button className="btn btn-secondary" onClick={loadSourceItems} disabled={loading}>
            {loading ? '加载中...' : '加载选中记录'}
          </button>
        </div>
        {sourceItems.length > 0 && (
          <p className="record-count">已加载 {sourceItems.length} 条记录</p>
        )}
      </div>

      {/* 客户信息 */}
      {sourceItems.length > 0 && (
        <>
          <BillToSection
            billTo={billTo}
            companyName={companyName}
            invoiceDate={invoiceDate}
            currency={currency}
            onBillToChange={setBillTo}
            onCompanyNameChange={setCompanyName}
            onInvoiceDateChange={setInvoiceDate}
            onCurrencyChange={setCurrency}
          />

          {/* 公司信息（可折叠编辑） */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">公司信息 / Company Info</h3>
              <button
                className="btn btn-text"
                onClick={() => setShowCompanyEdit(!showCompanyEdit)}
              >
                {showCompanyEdit ? '收起' : '编辑'}
              </button>
            </div>
            {!showCompanyEdit && (
              <p className="company-summary">
                {companyConfig.name} | {companyConfig.email}
              </p>
            )}
            {showCompanyEdit && (
              <CompanyInfoSection config={companyConfig} onChange={setCompanyConfig} />
            )}
          </div>

          {/* 明细预览表 */}
          <div className="section">
            <h3 className="section-title">账单明细预览 / Invoice Items</h3>
            <ItemsTable
              sourceItems={sourceItems}
              invoiceItems={preview?.items}
              currency={currency}
            />
          </div>

          {/* 汇总 */}
          <TotalsSummary preview={preview} currency={currency} />

          {/* 操作按钮 */}
          <div className="actions">
            <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
              {loading ? '计算中...' : '生成预览'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleGenerate}
              disabled={loading || !preview}
            >
              {loading ? '生成中...' : '生成正式账单'}
            </button>
          </div>
        </>
      )}

      {/* 结果区 */}
      <ResultSection result={result} />

      {result && (
        <div className="actions">
          <button className="btn btn-secondary" onClick={clearResult}>
            生成新账单
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

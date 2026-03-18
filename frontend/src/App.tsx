import React, { useState, useEffect } from "react";
import type { CompanyConfig, BrandTemplateId, TaxMode } from "./types";
import { useInvoice } from "./hooks/useInvoice";
import { CompanyInfoSection } from "./components/CompanyInfoSection";
import { BillToSection } from "./components/BillToSection";
import { ItemsTable } from "./components/ItemsTable";
import { TotalsSummary } from "./components/TotalsSummary";
import { ResultSection } from "./components/ResultSection";
import { TemplateSelector } from "./components/TemplateSelector";
import { BankAccountSelector } from "./components/BankAccountSelector";
import { TaxModeToggle } from "./components/TaxModeToggle";
import "./App.css";

const COMPANY_CONFIGS: Record<BrandTemplateId, CompanyConfig> = {
  feilong: {
    name: "Feilong Business Service (Shenzhen) Co., Ltd",
    address_line1: "2308B, Building A, Phase 1,",
    address_line2: "Shenzhen Longgang Bantian Xinghe WORLD",
    email: "finance@starlight.ph",
    logo_url: "",
    tax_note: "",
  },
  starlight: {
    name: "Starlight Business Consulting Services Inc.",
    address_line1: "Salustiana D. Ty Tower, Paseo De Roxas,",
    address_line2: "Legazpi Village, Makati City",
    address_line3: "Makati City, PH 1229",
    email: "finance@starlight.ph",
    logo_url: "",
    tax_note: "",
  },
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

  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(
    COMPANY_CONFIGS.feilong,
  );
  const [billTo, setBillTo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currency, setCurrency] = useState("¥");
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);
  const [templateId, setTemplateId] = useState<BrandTemplateId>("feilong");
  const [taxMode, setTaxMode] = useState<TaxMode>("tax_included");
  const [bankAccountId, setBankAccountId] = useState("");

  // 切换模板时更新公司信息
  useEffect(() => {
    const newConfig = COMPANY_CONFIGS[templateId] ?? COMPANY_CONFIGS.feilong;
    setCompanyConfig(newConfig);
  }, [templateId]);

  // 从源数据自动填充 bill_to 和 company_name
  useEffect(() => {
    if (sourceItems.length > 0) {
      const first = sourceItems[0];
      if (!billTo && first.bill_to) setBillTo(first.bill_to);
      if (!companyName && first.company_name)
        setCompanyName(first.company_name);
      if (first.currency) setCurrency(first.currency);
    }
  }, [sourceItems]);

  const handlePreview = () => {
    doPreview(
      companyConfig,
      billTo,
      currency,
      taxMode,
      templateId,
      bankAccountId,
    );
  };

  const handleGenerate = () => {
    if (!billTo.trim()) {
      alert("请填写 Bill To");
      return;
    }
    doGenerate(
      billTo,
      companyName || companyConfig.name,
      companyConfig,
      invoiceDate,
      currency,
      taxMode,
      templateId,
      bankAccountId,
    );
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
          <button
            className="btn btn-secondary"
            onClick={loadSourceItems}
            disabled={loading}
          >
            {loading ? "加载中..." : "加载选中记录"}
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

          {/* 品牌模板 / 含税模式 / 银行账户 */}
          <div className="section">
            <h3 className="section-title">账单设置 / Invoice Settings</h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  品牌模板 / Brand Template
                </label>
                <TemplateSelector value={templateId} onChange={setTemplateId} />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  含税模式 / Tax Mode
                </label>
                <TaxModeToggle value={taxMode} onChange={setTaxMode} />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  银行账户 / Bank Account
                </label>
                <BankAccountSelector
                  value={bankAccountId}
                  onChange={setBankAccountId}
                />
              </div>
            </div>
          </div>

          {/* 公司信息（可折叠编辑） */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">公司信息 / Company Info</h3>
              <button
                className="btn btn-text"
                onClick={() => setShowCompanyEdit(!showCompanyEdit)}
              >
                {showCompanyEdit ? "收起" : "编辑"}
              </button>
            </div>
            {!showCompanyEdit && (
              <p className="company-summary">
                {companyConfig.name} | {companyConfig.email}
              </p>
            )}
            {showCompanyEdit && (
              <CompanyInfoSection
                config={companyConfig}
                onChange={setCompanyConfig}
              />
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
            <button
              className="btn btn-primary"
              onClick={handlePreview}
              disabled={loading}
            >
              {loading ? "计算中..." : "生成预览"}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleGenerate}
              disabled={loading || !preview}
            >
              {loading ? "生成中..." : "生成正式账单"}
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

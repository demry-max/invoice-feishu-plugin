import React, { useState, useEffect, useMemo } from "react";
import type {
  CompanyConfig,
  BrandTemplateId,
  InvoiceType,
  VatRatePercent,
  DisplayCurrency,
  ExchangeRateRow,
} from "./types";
import { useInvoice } from "./hooks/useInvoice";
import { CompanyInfoSection } from "./components/CompanyInfoSection";
import { BillToSection } from "./components/BillToSection";
import { ItemsTable } from "./components/ItemsTable";
import { TotalsSummary } from "./components/TotalsSummary";
import { ResultSection } from "./components/ResultSection";
import { TemplateSelector } from "./components/TemplateSelector";
import { BankAccountSelector } from "./components/BankAccountSelector";
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

const VAT_OPTIONS: VatRatePercent[] = [1, 3, 6, 12];
const CURRENCY_OPTIONS: DisplayCurrency[] = ["CNY", "USD", "PHP"];

/**
 * Look up an exchange rate for (from → to) effective on or before `date`.
 * Returns 1 when from === to, or when no matching row is found.
 */
function findExchangeRate(
  rows: ExchangeRateRow[],
  from: string,
  to: string,
  date: string,
): number {
  if (!from || !to) return 1;
  const F = from.trim().toUpperCase();
  const T = to.trim().toUpperCase();
  if (F === T) return 1;

  const matches = rows
    .filter(
      (r) =>
        r.from_currency.toUpperCase() === F &&
        r.to_currency.toUpperCase() === T &&
        r.effective_date <= date,
    )
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  if (matches.length > 0) return matches[0].rate;

  // Try reciprocal
  const reciprocal = rows
    .filter(
      (r) =>
        r.from_currency.toUpperCase() === T &&
        r.to_currency.toUpperCase() === F &&
        r.effective_date <= date,
    )
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  if (reciprocal.length > 0 && reciprocal[0].rate > 0) {
    return 1 / reciprocal[0].rate;
  }

  return 1;
}

const App: React.FC = () => {
  const {
    sourceItems,
    preview,
    result,
    loading,
    error,
    exchangeRates,
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
  const [bankAccountId, setBankAccountId] = useState("");

  // New: invoice type + tax rate + display currency
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("consultant");
  const [vatRatePercent, setVatRatePercent] = useState<VatRatePercent>(6);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency | "">(
    "",
  );

  // Source currency from main record (first item)
  const sourceCurrency = useMemo(
    () => sourceItems[0]?.source_currency?.toUpperCase() || "",
    [sourceItems],
  );

  // Computed exchange rate for final-payment + display currency
  const exchangeRate = useMemo(() => {
    if (invoiceType !== "final_payment" || !displayCurrency) return 1;
    return findExchangeRate(
      exchangeRates,
      sourceCurrency,
      displayCurrency,
      invoiceDate,
    );
  }, [invoiceType, displayCurrency, sourceCurrency, invoiceDate, exchangeRates]);

  useEffect(() => {
    const newConfig = COMPANY_CONFIGS[templateId] ?? COMPANY_CONFIGS.feilong;
    setCompanyConfig(newConfig);
  }, [templateId]);

  useEffect(() => {
    if (sourceItems.length > 0) {
      const first = sourceItems[0];
      if (!billTo && first.bill_to) setBillTo(first.bill_to);
      if (!companyName && first.company_name)
        setCompanyName(first.company_name);
      if (first.currency) setCurrency(first.currency);
    }
  }, [sourceItems]);

  const previewOpts = {
    invoiceType,
    vatRatePercent: invoiceType === "consultant" ? vatRatePercent : undefined,
    displayCurrency:
      invoiceType === "final_payment" && displayCurrency
        ? displayCurrency
        : undefined,
    exchangeRate: invoiceType === "final_payment" ? exchangeRate : undefined,
    invoiceDate,
  };

  const handlePreview = () => {
    doPreview(
      companyConfig,
      billTo,
      currency,
      undefined, // tax_mode retired — derived from invoice_type on the server
      templateId,
      bankAccountId,
      previewOpts,
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
      undefined, // tax_mode retired — derived from invoice_type on the server
      templateId,
      bankAccountId,
      previewOpts,
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Invoice Generator</h1>
        <p className="subtitle">飞书多维表格账单生成插件</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

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

      {sourceItems.length > 0 && (
        <>
          {/* 账单类型 */}
          <div className="section">
            <h3 className="section-title">账单类型 / Invoice Type</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className={`btn ${invoiceType === "consultant" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setInvoiceType("consultant")}
              >
                顾问账单 / Consultant
              </button>
              <button
                className={`btn ${invoiceType === "final_payment" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setInvoiceType("final_payment")}
              >
                尾款账单 / Final Payment
              </button>
            </div>
          </div>

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

              {invoiceType === "consultant" && (
                <>
                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      税率比例 / Tax Rate Ratio
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {VAT_OPTIONS.map((v) => (
                        <button
                          key={v}
                          className={`btn ${vatRatePercent === v ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => setVatRatePercent(v)}
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {invoiceType === "final_payment" && (
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: "4px",
                      display: "block",
                    }}
                  >
                    展示币种 / Display Currency
                    {sourceCurrency && (
                      <span style={{ marginLeft: 8, color: "#999" }}>
                        (源币种: {sourceCurrency})
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className={`btn ${displayCurrency === "" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setDisplayCurrency("")}
                    >
                      原始
                    </button>
                    {CURRENCY_OPTIONS.map((c) => (
                      <button
                        key={c}
                        className={`btn ${displayCurrency === c ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setDisplayCurrency(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {displayCurrency && sourceCurrency && (
                    <p style={{ fontSize: "12px", color: "#666", marginTop: 6 }}>
                      汇率: 1 {sourceCurrency} = {exchangeRate.toFixed(6)}{" "}
                      {displayCurrency}{" "}
                      {exchangeRate === 1 && sourceCurrency !== displayCurrency
                        ? "(未在汇率表中找到匹配行)"
                        : ""}
                    </p>
                  )}
                </div>
              )}

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

          <div className="section">
            <h3 className="section-title">账单明细预览 / Invoice Items</h3>
            <ItemsTable
              sourceItems={sourceItems}
              invoiceItems={preview?.items}
              currency={currency}
            />
          </div>

          <TotalsSummary preview={preview} currency={currency} />

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

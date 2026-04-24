import React, { useState, useEffect, useMemo } from "react";
import type {
  CompanyConfig,
  BrandTemplateId,
  TaxMode,
  InvoiceType,
  VatRatePercent,
  DisplayCurrency,
  ExchangeRateRow,
} from "./types";
import { useInvoice, subscribeSelectionChange } from "./hooks/useInvoice";
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
/**
 * Per spec (三、一、汇率表): pick rows whose (from, to) match AND where
 * effective_date <= date <= expiry_date (expiry_date optional = open-ended).
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

  const inWindow = (r: ExchangeRateRow) =>
    r.effective_date <= date && (!r.expiry_date || date <= r.expiry_date);

  const byLatestEffective = (a: ExchangeRateRow, b: ExchangeRateRow) =>
    b.effective_date.localeCompare(a.effective_date);

  const direct = rows
    .filter(
      (r) =>
        r.from_currency.toUpperCase() === F &&
        r.to_currency.toUpperCase() === T &&
        inWindow(r),
    )
    .sort(byLatestEffective);
  if (direct.length > 0) return direct[0].rate;

  const reciprocal = rows
    .filter(
      (r) =>
        r.from_currency.toUpperCase() === T &&
        r.to_currency.toUpperCase() === F &&
        inWindow(r),
    )
    .sort(byLatestEffective);
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
    existingInvoices,
    loadSourceItems,
    doPreview,
    doGenerate,
    clearResult,
  } = useInvoice();
  const [dupDismissed, setDupDismissed] = useState(false);

  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(
    COMPANY_CONFIGS.feilong,
  );
  const [billTo, setBillTo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  // Currency symbol is now derived — see `currency` useMemo below.
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);
  const [templateId, setTemplateId] = useState<BrandTemplateId>("feilong");
  const [bankAccountId, setBankAccountId] = useState("");

  // New: invoice type + tax rate + display currency
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("consultant");
  const [vatRatePercent, setVatRatePercent] = useState<VatRatePercent>(6);
  const [taxMode, setTaxMode] = useState<TaxMode>("tax_included");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency | "">(
    "",
  );

  // Source currencies from main record (first item)
  const billCurrency = useMemo(
    () => sourceItems[0]?.source_currency?.toUpperCase() || "",
    [sourceItems],
  );
  const finalCurrency = useMemo(
    () => sourceItems[0]?.final_currency?.toUpperCase() || "",
    [sourceItems],
  );

  // Two-rate model for final_payment (per 账单调整需求 Copy.docx):
  //   rateBill  — Bill Currency       → display (Amount Billed / Paid / Refunded / Deductible)
  //   rateFinal — Final bill currency → display (Actual Amount Incurred)
  const rateBill = useMemo(() => {
    if (invoiceType !== "final_payment" || !displayCurrency) return 1;
    if (!billCurrency || billCurrency === displayCurrency) return 1;
    return findExchangeRate(exchangeRates, billCurrency, displayCurrency, invoiceDate);
  }, [invoiceType, displayCurrency, billCurrency, invoiceDate, exchangeRates]);

  const rateFinal = useMemo(() => {
    if (invoiceType !== "final_payment" || !displayCurrency) return 1;
    if (!finalCurrency || finalCurrency === displayCurrency) return 1;
    return findExchangeRate(exchangeRates, finalCurrency, displayCurrency, invoiceDate);
  }, [invoiceType, displayCurrency, finalCurrency, invoiceDate, exchangeRates]);

  // True when a rate was needed but the table yielded 1 (no matching row).
  const missingBillRate =
    invoiceType === "final_payment" &&
    !!displayCurrency &&
    billCurrency !== "" &&
    billCurrency !== displayCurrency &&
    rateBill === 1;
  const missingFinalRate =
    invoiceType === "final_payment" &&
    !!displayCurrency &&
    finalCurrency !== "" &&
    finalCurrency !== displayCurrency &&
    rateFinal === 1;

  useEffect(() => {
    const newConfig = COMPANY_CONFIGS[templateId] ?? COMPANY_CONFIGS.feilong;
    setCompanyConfig(newConfig);
  }, [templateId]);

  useEffect(() => {
    if (sourceItems.length > 0) {
      const first = sourceItems[0];
      // Bill To input captures the contact/customer name line
      if (!billTo && first.customer_name) setBillTo(first.customer_name);
      // Company name input captures the invoice heading line
      if (!companyName && first.company_name)
        setCompanyName(first.company_name);
    }
  }, [sourceItems]);

  // Currency symbol is derived:
  // - final_payment with chosen display currency → its symbol (¥ / $ / ₱)
  // - otherwise → symbol of the source Bill Currency (fallback ¥)
  const currency = useMemo(() => {
    const symbolFor = (code: string): string => {
      switch (code.toUpperCase()) {
        case "CNY":
          return "¥";
        case "USD":
          return "$";
        case "PHP":
          return "₱";
        case "EUR":
          return "€";
        default:
          return "";
      }
    };
    if (invoiceType === "final_payment" && displayCurrency) {
      return symbolFor(displayCurrency) || "¥";
    }
    return symbolFor(billCurrency) || "¥";
  }, [invoiceType, displayCurrency, billCurrency]);

  // Auto-load on mount + on selection change in Bitable
  useEffect(() => {
    loadSourceItems();
    const unsubscribe = subscribeSelectionChange(() => {
      loadSourceItems();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the dup-dismiss each time we load a new row
  useEffect(() => {
    setDupDismissed(false);
  }, [sourceItems]);

  // Debounced auto-preview when data or settings change
  useEffect(() => {
    if (sourceItems.length === 0) return;
    const handle = setTimeout(() => {
      doPreview(
        companyConfig,
        billTo,
        currency,
        undefined,
        templateId,
        bankAccountId,
        previewOpts,
      );
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceItems,
    invoiceType,
    vatRatePercent,
    displayCurrency,
    rateBill,
    rateFinal,
    templateId,
    bankAccountId,
    billTo,
    companyName,
    currency,
    invoiceDate,
    taxMode,
  ]);

  const previewOpts = {
    invoiceType,
    vatRatePercent: invoiceType === "consultant" ? vatRatePercent : undefined,
    displayCurrency:
      invoiceType === "final_payment" && displayCurrency
        ? displayCurrency
        : undefined,
    exchangeRateBill: invoiceType === "final_payment" ? rateBill : undefined,
    exchangeRateFinal: invoiceType === "final_payment" ? rateFinal : undefined,
    invoiceDate,
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

      {existingInvoices.length > 0 && !dupDismissed && (
        <div
          style={{
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            color: "#614700",
            padding: "10px 12px",
            marginBottom: 12,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            ⚠️ 此工单已生成过账单
          </div>
          <div style={{ lineHeight: 1.6 }}>
            {existingInvoices.map((inv) => (
              <div key={inv.invoice_no}>
                <strong>{inv.invoice_no}</strong>
                {" · "}
                {inv.invoice_type === "final_payment" ? "尾款" : "顾问"}
                {" · "}
                {inv.invoice_date}
                {" · "}
                {inv.currency}
                {inv.grand_total.toFixed(2)}
              </div>
            ))}
          </div>
          <button
            onClick={() => setDupDismissed(true)}
            style={{
              marginTop: 8,
              fontSize: 12,
              padding: "2px 10px",
              border: "1px solid #faad14",
              background: "#fff",
              color: "#614700",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            忽略并继续生成新账单 / Dismiss and Create New
          </button>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h3 className="section-title">选中记录 / Selected Records</h3>
          <button
            className="btn btn-secondary"
            onClick={loadSourceItems}
            disabled={loading}
          >
            {loading ? "加载中... / Loading..." : "加载选中记录 / Load Selected"}
          </button>
        </div>
        {sourceItems.length > 0 && (
          <p className="record-count">
            已加载 {sourceItems.length} 条记录 / {sourceItems.length} record
            {sourceItems.length > 1 ? "s" : ""} loaded
          </p>
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
            onBillToChange={setBillTo}
            onCompanyNameChange={setCompanyName}
            onInvoiceDateChange={setInvoiceDate}
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
                      含税模式 / Tax Mode
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className={`btn ${taxMode === "tax_excluded" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setTaxMode("tax_excluded")}
                      >
                        不含税
                      </button>
                      <button
                        className={`btn ${taxMode === "tax_included" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setTaxMode("tax_included")}
                      >
                        含税
                      </button>
                    </div>
                  </div>
                  {taxMode === "tax_included" && (
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
                  )}
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
                    {(billCurrency || finalCurrency) && (
                      <span style={{ marginLeft: 8, color: "#999" }}>
                        (Bill: {billCurrency || "—"} · Final: {finalCurrency || "—"})
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className={`btn ${displayCurrency === "" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setDisplayCurrency("")}
                    >
                      原始 / Original
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
                  {displayCurrency && (
                    <div style={{ fontSize: "12px", color: "#666", marginTop: 6 }}>
                      {billCurrency && billCurrency !== displayCurrency && (
                        <div>
                          Bill rate: 1 {billCurrency} = {rateBill.toFixed(6)}{" "}
                          {displayCurrency}{" "}
                          {missingBillRate && (
                            <span style={{ color: "#b85c00" }}>
                              (汇率表中无 {billCurrency}→{displayCurrency} 行)
                            </span>
                          )}
                        </div>
                      )}
                      {finalCurrency && finalCurrency !== displayCurrency && (
                        <div>
                          Final rate: 1 {finalCurrency} = {rateFinal.toFixed(6)}{" "}
                          {displayCurrency}{" "}
                          {missingFinalRate && (
                            <span style={{ color: "#b85c00" }}>
                              (汇率表中无 {finalCurrency}→{displayCurrency} 行)
                            </span>
                          )}
                        </div>
                      )}
                      {billCurrency === displayCurrency &&
                        finalCurrency === displayCurrency && (
                          <div>源币种与展示币种一致，无需换算</div>
                        )}
                    </div>
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
                {showCompanyEdit ? "收起 / Collapse" : "编辑 / Edit"}
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
              invoiceType={invoiceType}
            />
          </div>

          <TotalsSummary preview={preview} currency={currency} />

          <div className="actions">
            <button
              className="btn btn-danger"
              onClick={handleGenerate}
              disabled={loading || !preview}
            >
              {loading ? "生成中... / Generating..." : "生成正式账单 / Generate Invoice"}
            </button>
          </div>
        </>
      )}

      <ResultSection result={result} />

      {result && (
        <div className="actions">
          <button className="btn btn-secondary" onClick={clearResult}>
            生成新账单 / Create New Invoice
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

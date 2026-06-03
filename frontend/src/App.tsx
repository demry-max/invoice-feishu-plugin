import React, { useState, useEffect, useMemo } from "react";
import type {
  CompanyConfig,
  BrandTemplateId,
  TaxMode,
  InvoiceType,
  VatRatePercent,
  EwtRatePercent,
  DisplayCurrency,
  ExchangeRateRow,
} from "./types";
import { useInvoice, subscribeSelectionChange } from "./hooks/useInvoice";
import { usePersistentState } from "./hooks/usePersistentState";
import { CompanyInfoSection } from "./components/CompanyInfoSection";
import { BillToSection } from "./components/BillToSection";
import { ItemsTable } from "./components/ItemsTable";
import { TotalsSummary } from "./components/TotalsSummary";
import { ResultSection } from "./components/ResultSection";
import { TemplateSelector } from "./components/TemplateSelector";
import { BankAccountSelector } from "./components/BankAccountSelector";
import { InstallmentSection } from "./components/InstallmentSection";
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
const EWT_OPTIONS: EwtRatePercent[] = [0, 2, 10, 15];
const CURRENCY_OPTIONS: DisplayCurrency[] = ["CNY", "USD", "PHP", "THB"];

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
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [billToExpanded, setBillToExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  // Settings persisted per browser so users don't re-pick every session.
  const [templateId, setTemplateId] = usePersistentState<BrandTemplateId>(
    "templateId",
    "feilong",
  );
  const [bankAccountId, setBankAccountId] = usePersistentState<string>(
    "bankAccountId",
    "",
  );
  const [invoiceType, setInvoiceType] = usePersistentState<InvoiceType>(
    "invoiceType",
    "consultant",
  );
  const [vatRatePercent, setVatRatePercent] = usePersistentState<VatRatePercent>(
    "vatRatePercent",
    6,
  );
  const [ewtRatePercent, setEwtRatePercent] = usePersistentState<EwtRatePercent>(
    "ewtRatePercent",
    2,
  );
  const [taxMode, setTaxMode] = usePersistentState<TaxMode>(
    "taxMode",
    "tax_included",
  );
  const [displayCurrency, setDisplayCurrency] = usePersistentState<
    DisplayCurrency | ""
  >("displayCurrency", "");
  // Per spec req 4 — installment block. Toggle is persisted; the editable
  // overrides are session-only (reset on selection change so the formula
  // values can refresh from the current preview).
  const [showInstallment, setShowInstallment] = usePersistentState<boolean>(
    "showInstallment",
    false,
  );
  const [installmentOverrides, setInstallmentOverrides] = useState<{
    first_payment_ratio?: number;
    final_payment_ratio?: number;
    first_payment_amount?: number;
    final_payment_amount?: number;
    final_payment_business_days?: number;
  }>({});

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

  // Consultant per-row exchange rates (per spec req 3 — every Service Name
  // may have its own Currency on 任务明细表). Returns 1 for rows where no
  // conversion is needed or no rate row matches the invoice date window.
  const consultantRowRates = useMemo<number[]>(() => {
    if (invoiceType !== "consultant" || !displayCurrency) {
      return sourceItems.map(() => 1);
    }
    return sourceItems.map((s) => {
      const rowCurrency = (s.service_currency || s.source_currency || "")
        .trim()
        .toUpperCase();
      if (!rowCurrency || rowCurrency === displayCurrency) return 1;
      return findExchangeRate(
        exchangeRates,
        rowCurrency,
        displayCurrency,
        invoiceDate,
      );
    });
  }, [invoiceType, displayCurrency, sourceItems, invoiceDate, exchangeRates]);

  // Rows that needed a conversion but the table yielded 1 (no matching window).
  const missingConsultantRowRates = useMemo<string[]>(() => {
    if (invoiceType !== "consultant" || !displayCurrency) return [];
    const missing: string[] = [];
    sourceItems.forEach((s, idx) => {
      const rowCurrency = (s.service_currency || s.source_currency || "")
        .trim()
        .toUpperCase();
      if (
        rowCurrency &&
        rowCurrency !== displayCurrency &&
        consultantRowRates[idx] === 1
      ) {
        missing.push(`${s.service || `#${idx + 1}`} (${rowCurrency})`);
      }
    });
    return missing;
  }, [
    invoiceType,
    displayCurrency,
    sourceItems,
    consultantRowRates,
  ]);

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
  // - any invoice type with a chosen display currency → its symbol
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
        case "THB":
          return "฿";
        case "EUR":
          return "€";
        default:
          return "";
      }
    };
    if (displayCurrency) {
      return symbolFor(displayCurrency) || "¥";
    }
    return symbolFor(billCurrency) || "¥";
  }, [displayCurrency, billCurrency]);

  // Auto-load on mount + on selection change in Bitable
  useEffect(() => {
    loadSourceItems();
    const unsubscribe = subscribeSelectionChange(() => {
      loadSourceItems();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset dup-dismiss + clear stale result each time we load a new row
  useEffect(() => {
    setDupDismissed(false);
    clearResult();
    // Per spec req 4 — overrides reset when items change so the formula
    // defaults can refresh from the new preview.
    setInstallmentOverrides({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceItems]);

  // Debounced auto-preview when data or settings change
  useEffect(() => {
    if (sourceItems.length === 0) return;
    const handle = setTimeout(() => {
      doPreview(
        companyConfig,
        billTo,
        currency,
        taxMode,
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
    ewtRatePercent,
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
    showInstallment,
    installmentOverrides,
  ]);

  const previewOpts = {
    invoiceType,
    vatRatePercent: invoiceType === "consultant" ? vatRatePercent : undefined,
    ewtRatePercent: invoiceType === "consultant" ? ewtRatePercent : undefined,
    // Display Currency now applies to BOTH invoice types (per spec req 3).
    displayCurrency: displayCurrency || undefined,
    exchangeRateBill: invoiceType === "final_payment" ? rateBill : undefined,
    exchangeRateFinal: invoiceType === "final_payment" ? rateFinal : undefined,
    // Per-row consultant rates (per spec req 3 — each Service Name converts independently).
    exchangeRatesPerRow:
      invoiceType === "consultant" && displayCurrency
        ? consultantRowRates
        : undefined,
    // Per spec req 4 — installment block (consultant only).
    showInstallment: invoiceType === "consultant" && showInstallment,
    installment:
      invoiceType === "consultant" && showInstallment
        ? installmentOverrides
        : undefined,
    invoiceDate,
  };

  const handleGenerate = () => {
    // Per spec req 1: consultant invoices only need ONE of Bill To / Company Name.
    // Final-payment invoices still require Bill To.
    const billToOk = billTo.trim().length > 0;
    const companyOk = companyName.trim().length > 0;
    if (invoiceType === "consultant") {
      if (!billToOk && !companyOk) {
        alert(
          "请填写 Bill To 或 Company Name / Please fill in Bill To or Company Name",
        );
        return;
      }
    } else if (!billToOk) {
      alert("请填写 Bill To / Please fill in Bill To");
      return;
    }
    doGenerate(
      billTo,
      // Per spec req 1.3: do NOT fall back to the hard-coded company name
      // ("Feilong Business Service (Shenzhen) Co., Ltd") when Company Name
      // is blank — pass an empty string so the template renders only Bill To.
      companyName,
      companyConfig,
      invoiceDate,
      currency,
      taxMode,
      templateId,
      bankAccountId,
      previewOpts,
    );
  };

  // ⌘+Enter (Mac) / Ctrl+Enter — fire Generate when ready.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (cmdOrCtrl && e.key === "Enter") {
        if (loading || !preview || !sourceItems.length) return;
        // Mirror handleGenerate's validation: consultant needs Bill To OR
        // Company Name; final-payment still requires Bill To.
        const billToOk = billTo.trim().length > 0;
        const companyOk = companyName.trim().length > 0;
        if (invoiceType === "consultant") {
          if (!billToOk && !companyOk) return;
        } else if (!billToOk) {
          return;
        }
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, preview, sourceItems.length, billTo, companyName, invoiceType]);

  // The invoice number that will actually be used if the user generates now —
  // either the previously-saved one for this WO (reuse) or "new".
  const reuseInvoiceNo = useMemo(() => {
    if (!existingInvoices.length) return null;
    const same = existingInvoices.find((i) => i.invoice_type === invoiceType);
    return same?.invoice_no ?? null;
  }, [existingInvoices, invoiceType]);

  // Compact summary string for the collapsed Settings card.
  // Real-time validation — surfaced inline so user fixes before generating.
  const warnings = useMemo(() => {
    const out: string[] = [];
    if (sourceItems.length === 0) return out;

    if (invoiceType === "consultant" && taxMode === "tax_included") {
      const anyEligible = sourceItems.some((s) => s.tax_eligible);
      if (!anyEligible) {
        out.push(
          "所有服务行的 Taxation Identification 都不为 YES — VAT 与 EWT 将为 0",
        );
      }
    }

    if (invoiceType === "final_payment") {
      const allZero = sourceItems.every(
        (s) => (s.actual_amount_incurred ?? 0) === 0,
      );
      if (allZero) {
        out.push(
          "尚未填写任何 Actual Amount Incurred — 尾款账单需要先在任务明细表填写实际发生金额 / No Actual Amount Incurred entered — Final-Payment invoices require filling in the actual amount in the task detail table first",
        );
      }
    }
    return out;
  }, [sourceItems, invoiceType, taxMode]);

  const blockingError = useMemo(() => {
    if (sourceItems.length === 0) return null;
    const billToOk = billTo.trim().length > 0;
    const companyOk = companyName.trim().length > 0;
    if (invoiceType === "consultant") {
      if (!billToOk && !companyOk) {
        return "请填写 Bill To 或 Company Name / Please fill in Bill To or Company Name";
      }
    } else if (!billToOk) {
      return "请填写 Bill To / Please fill in Bill To";
    }
    return null;
  }, [sourceItems.length, billTo, companyName, invoiceType]);

  const settingsSummary = useMemo(() => {
    const parts: string[] = [
      templateId === "feilong" ? "菲龙咨询" : "Starlight",
    ];
    if (invoiceType === "consultant") {
      parts.push(taxMode === "tax_included" ? `含税 / Tax Included ${vatRatePercent}%` : "不含税 / Tax Excluded");
      if (taxMode === "tax_included" && templateId === "starlight") {
        parts.push(`EWT ${ewtRatePercent}%`);
      }
    } else {
      parts.push(displayCurrency ? `${displayCurrency}` : "原始币种");
    }
    return parts.join(" · ");
  }, [templateId, invoiceType, taxMode, vatRatePercent, ewtRatePercent, displayCurrency]);

  // Compact Bill-To summary.
  const billToSummary = useMemo(() => {
    const company = (companyName || "—").trim();
    const contact = (billTo || "").trim();
    if (contact && contact !== company) return `${company} · ${contact}`;
    return company;
  }, [companyName, billTo]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Invoice Generator</h1>
        <p className="subtitle">飞书多维表格账单生成插件</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* === Top status bar — replaces 选中记录 + dup warning + 账单类型 === */}
      <div className="status-bar">
        <div className="status-bar-line">
          <div className="status-bar-summary">
            {sourceItems.length === 0
              ? "👈 请先在表格中选中一条业务工单"
              : `${billToSummary} · ${sourceItems.length} 项`}
          </div>
          <button
            className="btn-link"
            onClick={loadSourceItems}
            disabled={loading}
            aria-label="刷新选中记录 / Refresh selected record"
          >
            {loading ? "⟳" : "⟳ 刷新 / Refresh"}
          </button>
        </div>

        {sourceItems.length > 0 && (
          <div className="status-bar-controls">
            <div className="seg">
              <button
                className={`seg-btn ${invoiceType === "consultant" ? "seg-active" : ""}`}
                onClick={() => setInvoiceType("consultant")}
              >
                顾问 / Consultant
              </button>
              <button
                className={`seg-btn ${invoiceType === "final_payment" ? "seg-active" : ""}`}
                onClick={() => setInvoiceType("final_payment")}
              >
                尾款 / Final Payment
              </button>
            </div>
            {reuseInvoiceNo && (
              <span
                className="badge badge-reuse"
                title="同 WO 已有账单，再次生成会覆盖同号"
              >
                ✓ 复用编号 {reuseInvoiceNo}
              </span>
            )}
          </div>
        )}

        {existingInvoices.length > 0 && !dupDismissed && !reuseInvoiceNo && (
          <div className="status-dup">
            ⚠️ 该工单已有{" "}
            {existingInvoices.map((inv) => inv.invoice_no).join(", ")}（不同类型）
            <button className="btn-link" onClick={() => setDupDismissed(true)}>
              忽略
            </button>
          </div>
        )}

        {existingInvoices.length > 0 && (
          <details
            className="history-panel"
            open={historyOpen}
            onToggle={(e) =>
              setHistoryOpen((e.target as HTMLDetailsElement).open)
            }
          >
            <summary>
              📚 该工单历史账单 ({existingInvoices.length})
            </summary>
            <ul className="history-list">
              {existingInvoices.map((inv) => (
                <li key={inv.invoice_no}>
                  <span className="history-no">{inv.invoice_no}</span>
                  <span className="history-type">
                    {inv.invoice_type === "final_payment" ? "尾款 / Final" : "顾问 / Consultant"}
                  </span>
                  <span className="history-date">{inv.invoice_date}</span>
                  <span className="history-amt">
                    {inv.currency}
                    {inv.grand_total.toFixed(2)}
                  </span>
                  {inv.pdf_url && (
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-link"
                    >
                      PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        {blockingError && (
          <div className="status-error">⛔ {blockingError}</div>
        )}
        {warnings.map((w) => (
          <div key={w} className="status-warn">⚠️ {w}</div>
        ))}
      </div>

      {sourceItems.length > 0 && (
        <>

          {/* === Collapsible Bill-To === */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">客户信息 / Bill To</h3>
              <button
                className="btn-link"
                onClick={() => setBillToExpanded(!billToExpanded)}
              >
                {billToExpanded ? "收起 / Collapse" : "编辑 / Edit"}
              </button>
            </div>
            {!billToExpanded ? (
              <p className="row-summary">
                {billToSummary}
                <span className="row-summary-meta"> · {invoiceDate}</span>
              </p>
            ) : (
              <BillToSection
                billTo={billTo}
                companyName={companyName}
                invoiceDate={invoiceDate}
                onBillToChange={setBillTo}
                onCompanyNameChange={setCompanyName}
                onInvoiceDateChange={setInvoiceDate}
              />
            )}
          </div>

          {/* === Brand template — always visible (high-impact choice) === */}
          <div className="section">
            <h3 className="section-title">品牌模板 / Brand Template</h3>
            <TemplateSelector value={templateId} onChange={setTemplateId} />
          </div>

          {/* === Collapsible Settings === */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">账单设置 / Invoice Settings</h3>
              <button
                className="btn-link"
                onClick={() => setSettingsExpanded(!settingsExpanded)}
              >
                {settingsExpanded ? "收起 / Collapse" : "展开 / Expand"}
              </button>
            </div>
            {!settingsExpanded && (
              <p className="row-summary">{settingsSummary}</p>
            )}
            <div
              style={{
                display: settingsExpanded ? "flex" : "none",
                flexDirection: "column",
                gap: "12px",
              }}
            >
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
                        不含税 / Tax Excluded
                      </button>
                      <button
                        className={`btn ${taxMode === "tax_included" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setTaxMode("tax_included")}
                      >
                        含税 / Tax Included
                      </button>
                    </div>
                  </div>
                  {taxMode === "tax_included" && (
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
                      {templateId === "starlight" && (
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              marginBottom: "4px",
                              display: "block",
                            }}
                          >
                            预扣税比例 / EWT Rate
                          </label>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {EWT_OPTIONS.map((v) => (
                              <button
                                key={v}
                                className={`btn ${ewtRatePercent === v ? "btn-primary" : "btn-secondary"}`}
                                onClick={() => setEwtRatePercent(v)}
                              >
                                {v}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/*
                Display Currency selector.
                Final-payment: two-rate model (Bill Currency, Final Currency)
                  shown as hints.
                Consultant: per-row conversion using each Service Name's own
                  source currency (per spec req 3).
              */}
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
                  {invoiceType === "final_payment" && (billCurrency || finalCurrency) && (
                    <span style={{ marginLeft: 8, color: "#999" }}>
                      (Bill: {billCurrency || "—"} · Final: {finalCurrency || "—"})
                    </span>
                  )}
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
                {displayCurrency && invoiceType === "final_payment" && (
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
                        <div>源币种与展示币种一致，无需换算 / Source currency matches display currency, no conversion needed</div>
                      )}
                  </div>
                )}
                {displayCurrency && invoiceType === "consultant" &&
                  missingConsultantRowRates.length > 0 && (
                    <div style={{ fontSize: "12px", color: "#b85c00", marginTop: 6 }}>
                      汇率表中找不到以下服务行的换算汇率 / Missing exchange rate
                      rows for: {missingConsultantRowRates.join(", ")}
                    </div>
                  )}
              </div>

              {invoiceType === "consultant" && (
                <InstallmentSection
                  showInstallment={showInstallment}
                  onShowInstallmentChange={setShowInstallment}
                  defaults={preview?.installment_info}
                  overrides={installmentOverrides}
                  onOverridesChange={setInstallmentOverrides}
                  currency={currency}
                />
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
              invoiceDate={invoiceDate}
            />
          </div>

          <TotalsSummary preview={preview} currency={currency} />
        </>
      )}

      <ResultSection result={result} />

      {/* === Sticky bottom action bar — always-visible Grand Total + Generate === */}
      {sourceItems.length > 0 && (
        <div className="sticky-bottom">
          <div className="sticky-bottom-total">
            <span className="sticky-bottom-label">Grand Total</span>
            <span className="sticky-bottom-amount">
              {preview
                ? `${currency}${preview.grand_total.toFixed(2)}`
                : "—"}
            </span>
          </div>
          <button
            className="btn btn-danger sticky-bottom-cta"
            onClick={handleGenerate}
            disabled={loading || !preview || !!blockingError}
            title={blockingError ?? "⌘+Enter"}
          >
            {loading
              ? "生成中... / Generating..."
              : reuseInvoiceNo
                ? `覆盖生成 / Overwrite ${reuseInvoiceNo}`
                : "生成正式账单 / Generate Invoice"}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

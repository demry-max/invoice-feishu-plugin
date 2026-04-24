import { useState, useCallback } from "react";
import type {
  SourceItem,
  PreviewResponse,
  GenerateResponse,
  CompanyConfig,
  TaxMode,
  BrandTemplateId,
  InvoiceType,
  VatRatePercent,
  DisplayCurrency,
  ExchangeRateRow,
  Invoice,
} from "../types";
import {
  previewInvoice,
  generateInvoice,
  fetchInvoicesForSourceRecord,
} from "../services/api";
import { createFrontendAdapter } from "../adapters/feishu-adapter";

const adapter = createFrontendAdapter();

/** Subscribe to Bitable selection changes from components. */
export function subscribeSelectionChange(cb: () => void): () => void {
  return adapter.onSelectionChange(cb);
}

export interface UseInvoiceState {
  sourceItems: SourceItem[];
  preview: PreviewResponse | null;
  result: GenerateResponse | null;
  loading: boolean;
  error: string | null;
  exchangeRates: ExchangeRateRow[];
  existingInvoices: Invoice[];
}

export interface PreviewOptions {
  invoiceType?: InvoiceType;
  vatRatePercent?: VatRatePercent;
  displayCurrency?: DisplayCurrency;
  exchangeRate?: number;
  invoiceDate?: string;
}

export function useInvoice() {
  const [state, setState] = useState<UseInvoiceState>({
    sourceItems: [],
    preview: null,
    result: null,
    loading: false,
    error: null,
    exchangeRates: [],
    existingInvoices: [],
  });

  const refreshExistingInvoices = useCallback(async () => {
    const mainIds = adapter.getMainRecordIds();
    if (mainIds.length === 0) {
      setState((s) => ({ ...s, existingInvoices: [] }));
      return;
    }
    try {
      const lists = await Promise.all(
        mainIds.map((id) =>
          fetchInvoicesForSourceRecord(id).catch(() => [] as Invoice[]),
        ),
      );
      const seen = new Set<string>();
      const deduped: Invoice[] = [];
      for (const inv of lists.flat()) {
        if (!seen.has(inv.invoice_no)) {
          seen.add(inv.invoice_no);
          deduped.push(inv);
        }
      }
      setState((s) => ({ ...s, existingInvoices: deduped }));
    } catch (err) {
      console.warn("[useInvoice] refreshExistingInvoices failed:", err);
    }
  }, []);

  const loadSourceItems = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [items, rates] = await Promise.all([
        adapter.getSelectedRecords(),
        adapter.getExchangeRates().catch((err) => {
          console.warn("[useInvoice] getExchangeRates failed:", err);
          return [] as ExchangeRateRow[];
        }),
      ]);
      setState((s) => ({
        ...s,
        sourceItems: items,
        exchangeRates: rates,
        loading: false,
      }));
      void refreshExistingInvoices();
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: String(err) }));
    }
  }, [refreshExistingInvoices]);

  const doPreview = useCallback(
    async (
      companyConfig?: Partial<CompanyConfig>,
      billTo?: string,
      currency?: string,
      taxMode?: TaxMode,
      templateId?: BrandTemplateId,
      bankAccountId?: string,
      opts?: PreviewOptions,
    ) => {
      if (state.sourceItems.length === 0) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await previewInvoice({
          items: state.sourceItems,
          company_config: companyConfig,
          bill_to: billTo,
          currency,
          tax_mode: taxMode,
          template_id: templateId,
          bank_account_id: bankAccountId,
          invoice_type: opts?.invoiceType,
          vat_rate_percent: opts?.vatRatePercent,
          display_currency: opts?.displayCurrency,
          exchange_rate: opts?.exchangeRate,
          invoice_date: opts?.invoiceDate,
        });
        setState((s) => ({ ...s, preview: res, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    [state.sourceItems, refreshExistingInvoices],
  );

  const doGenerate = useCallback(
    async (
      billTo: string,
      companyName: string,
      companyConfig?: Partial<CompanyConfig>,
      invoiceDate?: string,
      currency?: string,
      taxMode?: TaxMode,
      templateId?: BrandTemplateId,
      bankAccountId?: string,
      opts?: PreviewOptions,
    ) => {
      if (state.sourceItems.length === 0) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await generateInvoice({
          items: state.sourceItems,
          bill_to: billTo,
          company_name: companyName,
          company_config: companyConfig,
          invoice_date: invoiceDate,
          currency,
          tax_mode: taxMode,
          template_id: templateId,
          bank_account_id: bankAccountId,
          invoice_type: opts?.invoiceType,
          vat_rate_percent: opts?.vatRatePercent,
          display_currency: opts?.displayCurrency,
          exchange_rate: opts?.exchangeRate,
        });
        setState((s) => ({ ...s, result: res, loading: false }));

        adapter
          .writeBackInvoiceUrls(res.invoice_no, res.html_url, res.pdf_url)
          .catch((writeErr) =>
            console.error("[useInvoice] Write-back failed:", writeErr),
          );
        void refreshExistingInvoices();
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    [state.sourceItems, refreshExistingInvoices],
  );

  const clearResult = useCallback(() => {
    setState((s) => ({ ...s, result: null, preview: null }));
  }, []);

  return {
    ...state,
    loadSourceItems,
    doPreview,
    doGenerate,
    clearResult,
    refreshExistingInvoices,
  };
}

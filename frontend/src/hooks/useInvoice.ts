import { useState, useCallback } from 'react';
import type {
  SourceItem,
  PreviewResponse,
  GenerateResponse,
  CompanyConfig,
} from '../types';
import { previewInvoice, generateInvoice } from '../services/api';
import { createFrontendAdapter } from '../adapters/feishu-adapter';

const adapter = createFrontendAdapter();

export interface UseInvoiceState {
  sourceItems: SourceItem[];
  preview: PreviewResponse | null;
  result: GenerateResponse | null;
  loading: boolean;
  error: string | null;
}

export function useInvoice() {
  const [state, setState] = useState<UseInvoiceState>({
    sourceItems: [],
    preview: null,
    result: null,
    loading: false,
    error: null,
  });

  const loadSourceItems = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const items = await adapter.getSelectedRecords();
      setState((s) => ({ ...s, sourceItems: items, loading: false }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: String(err) }));
    }
  }, []);

  const doPreview = useCallback(
    async (companyConfig?: Partial<CompanyConfig>, billTo?: string, currency?: string) => {
      if (state.sourceItems.length === 0) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await previewInvoice({
          items: state.sourceItems,
          company_config: companyConfig,
          bill_to: billTo,
          currency,
        });
        setState((s) => ({ ...s, preview: res, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    [state.sourceItems]
  );

  const doGenerate = useCallback(
    async (
      billTo: string,
      companyName: string,
      companyConfig?: Partial<CompanyConfig>,
      invoiceDate?: string,
      currency?: string
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
        });
        setState((s) => ({ ...s, result: res, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      }
    },
    [state.sourceItems]
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
  };
}

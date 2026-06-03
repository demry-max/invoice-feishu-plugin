// ============================================================
// Shared Types - Used by both frontend and backend
// ============================================================

/** 品牌模板 ID */
export type BrandTemplateId = "feilong" | "starlight";

/** 含税模式 */
export type TaxMode = "tax_excluded" | "tax_included";

/** 账单类型 */
export type InvoiceType = "consultant" | "final_payment";

/** 支持的展示币种 */
export type DisplayCurrency = "CNY" | "USD" | "PHP" | "THB";

/** 支持的 VAT 比例（顾问账单可选） */
export type VatRatePercent = 1 | 3 | 6 | 12;

/** 支持的 EWT 比例（顾问账单可选） */
export type EwtRatePercent = 0 | 2 | 10 | 15;

/** 银行账户 */
export interface BankAccount {
  id: string;
  label: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_address?: string;
  swift_code?: string;
  currency_label?: string;
  payment_title: string;
}

/** 源项目表记录 */
export interface SourceItem {
  record_id?: string;
  customer_name: string;
  bill_to: string;
  company_name: string;
  invoice_date?: string;
  service: string;
  service_period: string;
  price: number;
  qty: number;
  discount_percent: number;
  chinese_translation: string;
  remark: string;
  currency?: string;
  status?: string;
  // Consultant invoice (顾问账单): VAT/EWT only applied when true
  tax_eligible?: boolean;
  // Final-payment invoice (尾款账单): actual amount billed by PH finance
  actual_amount_incurred?: number;
  // Final-payment invoice: running amount already paid per line
  amount_paid?: number;
  // Final-payment invoice: billed amount per service line (服务明细表.Total)
  amount_billed?: number;
  // Final-payment invoice: main-record identifiers copied onto each line
  bill_number?: string;
  billing_date?: string;
  // Main-record context (same for every line in one invoice)
  amount_refunded?: number;
  total_deduction_amount?: number;
  // Source record's "billed-side" currency (Amount Billed / Paid / Refunded / Deductible)
  source_currency?: string;
  // Source record's "final" currency (Actual Amount Incurred)
  final_currency?: string;
  /**
   * Per-row source currency from the 任务明细表/Task Detail List `Currency`
   * column (per spec req 3). Used by the consultant flow to look up an
   * exchange rate per Service Name; falls back to `source_currency` (main
   * table Bill Currency) when absent.
   */
  service_currency?: string;
  /**
   * Per-row First Payment Ratio from the 任务明细表/Task Detail List
   * `First Payment Ratio` column (per spec req 4). Used as the per-line
   * default when computing the first-payment amount for the installment block.
   * Expressed as a fraction in [0, 1].
   */
  first_payment_ratio?: number;
  /**
   * Main-ticket First Payment Ratio (per spec req 4 — display percentage).
   * Replicated onto each SourceItem so the backend doesn't need a separate
   * request field. Expressed as a fraction in [0, 1].
   */
  main_first_payment_ratio?: number;
}

/** 汇率表行：按账单生成日期在 [effective_date, expiry_date] 区间内查找 */
export interface ExchangeRateRow {
  effective_date: string; // YYYY-MM-DD
  expiry_date?: string; // YYYY-MM-DD (optional, open-ended if missing)
  from_currency: string; // "Original currency" on 汇率表
  to_currency: string; // "Target currency" on 汇率表
  rate: number;
}

/** 账单明细 */
export interface InvoiceItem {
  invoice_no: string;
  service: string;
  service_period: string;
  price: number;
  qty: number;
  discount_percent: number;
  line_total: number;
  chinese_translation: string;
  remark: string;
  sort_order: number;
  tax_eligible?: boolean;
  // Final-payment-only fields
  actual_amount_incurred?: number;
  amount_paid?: number;
  amount_billed?: number;
  balance?: number;
  bill_number?: string;
  billing_date?: string;
  note?: string;
}

/** 账单主表 */
export interface Invoice {
  invoice_no: string;
  company_name: string;
  bill_to: string;
  invoice_date: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  currency: string;
  tax_mode: TaxMode;
  template_id: BrandTemplateId;
  footer_note: string;
  bank_account: BankAccount;
  html_url?: string;
  pdf_url?: string;
  /** Per spec req 2 — Word (.docx) URL for consultant invoices. */
  word_url?: string;
  source_record_ids: string[];
  created_at: string;
  status: string;
  items: InvoiceItem[];
  // New fields for the two invoice types
  invoice_type?: InvoiceType;
  taxable_subtotal?: number;
  ewt_rate?: number;
  ewt_amount?: number;
  amount_paid_total?: number;
  amount_refunded?: number;
  total_deduction_amount?: number;
  exchange_rate?: number;
  display_currency?: string;
  // Final-payment-specific totals
  total_balance?: number;
  final_balance?: number;
  // Client header for final-payment template
  client_name?: string;
  client_company?: string;
  /** Optional installment block to render under Grand Total (consultant only). */
  installment_info?: InstallmentInfo;
}

/** 公司信息配置 */
export interface CompanyConfig {
  name: string;
  address_line1: string;
  address_line2: string;
  address_line3?: string;
  email: string;
  logo_url: string;
  tax_note: string;
}

/** 预览请求 */
export interface PreviewRequest {
  items: SourceItem[];
  company_config?: Partial<CompanyConfig>;
  bill_to?: string;
  currency?: string;
  tax_mode?: TaxMode;
  template_id?: BrandTemplateId;
  bank_account_id?: string;
  invoice_type?: InvoiceType;
  vat_rate_percent?: VatRatePercent;
  ewt_rate_percent?: EwtRatePercent;
  display_currency?: DisplayCurrency;
  /** @deprecated use exchange_rate_bill + exchange_rate_final */
  exchange_rate?: number;
  /** Rate applied to Bill Currency → display (Amount Billed / Paid / Refunded / Deductible) */
  exchange_rate_bill?: number;
  /** Rate applied to Final bill currency → display (Actual Amount Incurred) */
  exchange_rate_final?: number;
  /**
   * Consultant per-row exchange rates, parallel to `items`. When set, each
   * service row's `price` is multiplied by the matching rate before further
   * calculation. Used when each Service Name has its own source currency
   * (per spec req 3). When undefined or shorter than items, missing slots
   * default to 1 (no conversion).
   */
  exchange_rates_per_row?: number[];
  invoice_date?: string;
}

/** 预览响应 */
export interface PreviewResponse {
  items: InvoiceItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  currency: string;
  tax_mode: TaxMode;
  invoice_type?: InvoiceType;
  taxable_subtotal?: number;
  ewt_rate?: number;
  ewt_amount?: number;
  amount_paid_total?: number;
  amount_refunded?: number;
  total_deduction_amount?: number;
  exchange_rate?: number;
  display_currency?: string;
  total_balance?: number;
  final_balance?: number;
  installment_info?: InstallmentInfo;
}

/** 顾问账单分期付款数据（per spec req 4） */
export interface InstallmentInfo {
  /** First-payment ratio as a fraction (e.g. 0.5 for 50%). */
  first_payment_ratio: number;
  /** Final-payment ratio (1 - first). */
  final_payment_ratio: number;
  /** First-payment amount in display currency. */
  first_payment_amount: number;
  /** Final-payment amount in display currency. */
  final_payment_amount: number;
  /** Business days the final payment is due after service completion. */
  final_payment_business_days: number;
}

/** 生成账单请求 */
export interface GenerateRequest {
  items: SourceItem[];
  company_config?: Partial<CompanyConfig>;
  bill_to: string;
  company_name: string;
  invoice_date?: string;
  currency?: string;
  tax_mode?: TaxMode;
  template_id?: BrandTemplateId;
  bank_account_id?: string;
  invoice_type?: InvoiceType;
  vat_rate_percent?: VatRatePercent;
  ewt_rate_percent?: EwtRatePercent;
  display_currency?: DisplayCurrency;
  exchange_rate?: number;
  exchange_rate_bill?: number;
  exchange_rate_final?: number;
  /** Per-row consultant exchange rates parallel to `items`. See PreviewRequest. */
  exchange_rates_per_row?: number[];
  /** When true, render the installment-payment block under Grand Total (consultant only). */
  show_installment?: boolean;
  /** Editable installment values (per spec req 4). Falls back to formula defaults. */
  installment?: Partial<InstallmentInfo>;
}

/** 生成账单响应 */
export interface GenerateResponse {
  invoice_no: string;
  html_url: string;
  pdf_url: string;
  /** Per spec req 2 — consultant invoices include a Word (.docx) link. */
  word_url?: string;
  invoice: Invoice;
}

/** API 通用响应 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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
export type DisplayCurrency = "CNY" | "USD" | "PHP";

/** 支持的 VAT 比例（顾问账单可选） */
export type VatRatePercent = 1 | 3 | 6 | 12;

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
  // Source record's bill currency (e.g., "CNY", "USD", "PHP")
  source_currency?: string;
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
  display_currency?: DisplayCurrency;
  exchange_rate?: number;
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
  display_currency?: DisplayCurrency;
  exchange_rate?: number;
}

/** 生成账单响应 */
export interface GenerateResponse {
  invoice_no: string;
  html_url: string;
  pdf_url: string;
  invoice: Invoice;
}

/** API 通用响应 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// Shared Types - Used by both frontend and backend
// ============================================================

/** 品牌模板 ID */
export type BrandTemplateId = "feilong" | "starlight";

/** 含税模式 */
export type TaxMode = "tax_excluded" | "tax_included";

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

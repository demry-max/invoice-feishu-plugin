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
  footer_note: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
  html_url?: string;
  pdf_url?: string;
  source_record_ids: string[];
  created_at: string;
  status: string;
  items: InvoiceItem[];
}

export interface CompanyConfig {
  name: string;
  address_line1: string;
  address_line2: string;
  email: string;
  logo_url: string;
  tax_note: string;
  bank_payment_title: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
}

export interface PreviewRequest {
  items: SourceItem[];
  company_config?: Partial<CompanyConfig>;
  bill_to?: string;
  currency?: string;
}

export interface PreviewResponse {
  items: InvoiceItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  currency: string;
}

export interface GenerateRequest {
  items: SourceItem[];
  company_config?: Partial<CompanyConfig>;
  bill_to: string;
  company_name: string;
  invoice_date?: string;
  currency?: string;
}

export interface GenerateResponse {
  invoice_no: string;
  html_url: string;
  pdf_url: string;
  invoice: Invoice;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

import type { CompanyConfig } from '../types';

/** 默认公司配置 - 不要硬编码到模板中 */
export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  name: 'Feilong Business Service (Shenzhen) Co., Ltd',
  address_line1: '2308B, Building A, Phase 1,',
  address_line2: 'Shenzhen Longgang Bantian Xinghe WORLD',
  email: 'finance@starlight.ph',
  logo_url: '',
  tax_note: '注:上述报价不含税；如需开票，可加收1%费用开具增值税普通发票，或加收3%费用开具增值税专用发票。可开具增值税专用发票。',
  bank_payment_title: 'Please Deposit Payment to the Following Bank Account',
  bank_account_name: '菲娱咨询服务（深圳）有限公司',
  bank_account_number: '641971264',
  bank_name: '民生银行深圳分行营业部',
};

export function mergeCompanyConfig(override?: Partial<CompanyConfig>): CompanyConfig {
  if (!override) return { ...DEFAULT_COMPANY_CONFIG };
  return { ...DEFAULT_COMPANY_CONFIG, ...override };
}

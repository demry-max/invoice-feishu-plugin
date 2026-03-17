import type { CompanyConfig, BrandTemplateId } from '../types';

/** 菲龙咨询 默认公司配置 */
export const FEILONG_COMPANY_CONFIG: CompanyConfig = {
  name: 'Feilong Business Service (Shenzhen) Co., Ltd',
  address_line1: '2308B, Building A, Phase 1,',
  address_line2: 'Shenzhen Longgang Bantian Xinghe WORLD',
  email: 'finance@starlight.ph',
  logo_url: '',
  tax_note: '注:上述报价不含税；如需开票，可加收1%费用开具增值税普通发票，或加收3%费用开具增值税专用发票。可开具增值税专用发票。',
};

/** 星耀财税 默认公司配置 */
export const STARLIGHT_COMPANY_CONFIG: CompanyConfig = {
  name: 'Starlight Business Consulting Services Inc.',
  address_line1: 'Salustiana D. Ty Tower, Paseo De Roxas,',
  address_line2: 'Legazpi Village, Makati City, PH 1229',
  email: 'finance@starlight.ph',
  logo_url: '',
  tax_note: 'Starlight Business Consulting Services Inc',
};

/** 根据模板 ID 获取默认配置 */
const CONFIG_BY_TEMPLATE: Record<BrandTemplateId, CompanyConfig> = {
  feilong: FEILONG_COMPANY_CONFIG,
  starlight: STARLIGHT_COMPANY_CONFIG,
};

/** 向后兼容 - DEFAULT_COMPANY_CONFIG */
export const DEFAULT_COMPANY_CONFIG = FEILONG_COMPANY_CONFIG;

export function getCompanyConfigForTemplate(
  templateId: BrandTemplateId,
  override?: Partial<CompanyConfig>,
): CompanyConfig {
  const base = CONFIG_BY_TEMPLATE[templateId] ?? FEILONG_COMPANY_CONFIG;
  if (!override) return { ...base };
  return { ...base, ...override };
}

export function mergeCompanyConfig(override?: Partial<CompanyConfig>): CompanyConfig {
  if (!override) return { ...DEFAULT_COMPANY_CONFIG };
  return { ...DEFAULT_COMPANY_CONFIG, ...override };
}

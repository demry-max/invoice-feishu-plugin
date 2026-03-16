/**
 * 飞书多维表格适配器
 *
 * 将所有飞书 SDK 相关逻辑封装在此文件中。
 * MVP 阶段使用 mock 模式，后续替换为真实飞书 Base Extension SDK 调用。
 *
 * 接口设计遵循飞书 Bitable Extension SDK 的常见模式:
 * - bitable.base.getActiveTable()
 * - table.getRecordList()
 * - table.addRecord()
 * - table.setRecord()
 */

import type { SourceItem, Invoice, InvoiceItem } from '../types';

export interface FeishuAdapter {
  /** 读取选中的源项目记录 */
  getSelectedSourceItems(): Promise<SourceItem[]>;

  /** 将账单主数据写入 Invoices 表 */
  writeInvoice(invoice: Invoice): Promise<void>;

  /** 将账单明细写入 InvoiceItems 表 */
  writeInvoiceItems(items: InvoiceItem[]): Promise<void>;

  /** 将 html_url / pdf_url 回写到 Invoices 表 */
  updateInvoiceUrls(invoiceNo: string, htmlUrl: string, pdfUrl: string): Promise<void>;
}

/** Mock 适配器 - 用于本地开发和测试 */
export class MockFeishuAdapter implements FeishuAdapter {
  async getSelectedSourceItems(): Promise<SourceItem[]> {
    return MOCK_SOURCE_ITEMS;
  }

  async writeInvoice(invoice: Invoice): Promise<void> {
    console.log('[MockFeishu] writeInvoice:', invoice.invoice_no);
  }

  async writeInvoiceItems(items: InvoiceItem[]): Promise<void> {
    console.log('[MockFeishu] writeInvoiceItems:', items.length, 'items');
  }

  async updateInvoiceUrls(invoiceNo: string, htmlUrl: string, pdfUrl: string): Promise<void> {
    console.log('[MockFeishu] updateInvoiceUrls:', invoiceNo, htmlUrl, pdfUrl);
  }
}

/**
 * 真实飞书适配器（骨架）
 * TODO: 接入飞书 Bitable Extension SDK 后实现
 */
export class RealFeishuAdapter implements FeishuAdapter {
  // private bitable: any; // 飞书 SDK 实例

  async getSelectedSourceItems(): Promise<SourceItem[]> {
    // TODO: 实现真实飞书 SDK 调用
    // const table = await this.bitable.base.getTableByName('SourceItems');
    // const selection = await this.bitable.base.getSelection();
    // const records = await table.getRecordsByIds(selection.recordIds);
    // return records.map(mapRecordToSourceItem);
    throw new Error('RealFeishuAdapter not implemented yet');
  }

  async writeInvoice(_invoice: Invoice): Promise<void> {
    // TODO: const table = await this.bitable.base.getTableByName('Invoices');
    // await table.addRecord({ fields: mapInvoiceToFields(invoice) });
    throw new Error('RealFeishuAdapter not implemented yet');
  }

  async writeInvoiceItems(_items: InvoiceItem[]): Promise<void> {
    // TODO: const table = await this.bitable.base.getTableByName('InvoiceItems');
    // for (const item of items) {
    //   await table.addRecord({ fields: mapItemToFields(item) });
    // }
    throw new Error('RealFeishuAdapter not implemented yet');
  }

  async updateInvoiceUrls(_invoiceNo: string, _htmlUrl: string, _pdfUrl: string): Promise<void> {
    // TODO: 查找记录并更新 html_url, pdf_url 字段
    throw new Error('RealFeishuAdapter not implemented yet');
  }
}

/** 创建适配器实例 */
export function createFeishuAdapter(): FeishuAdapter {
  const useMock = process.env.FEISHU_MODE !== 'real';
  if (useMock) {
    console.log('[FeishuAdapter] Using MOCK mode');
    return new MockFeishuAdapter();
  }
  console.log('[FeishuAdapter] Using REAL mode');
  return new RealFeishuAdapter();
}

// ============================================================
// Mock 数据
// ============================================================
export const MOCK_SOURCE_ITEMS: SourceItem[] = [
  {
    record_id: 'rec_001',
    customer_name: 'Starlight Philippines Inc.',
    bill_to: 'Starlight Philippines Inc.',
    company_name: 'Feilong Business Service (Shenzhen) Co., Ltd',
    service: 'Recruitment Service - Senior Developer',
    service_period: '2026-01 ~ 2026-03',
    price: 15000,
    qty: 1,
    discount_percent: 0,
    chinese_translation: '高级开发人员招聘服务',
    remark: 'Onsite',
    currency: '¥',
    status: 'active',
  },
  {
    record_id: 'rec_002',
    customer_name: 'Starlight Philippines Inc.',
    bill_to: 'Starlight Philippines Inc.',
    company_name: 'Feilong Business Service (Shenzhen) Co., Ltd',
    service: 'HR Outsourcing Service',
    service_period: '2026-03',
    price: 8000,
    qty: 3,
    discount_percent: 10,
    chinese_translation: '人力资源外包服务',
    remark: '',
    currency: '¥',
    status: 'active',
  },
  {
    record_id: 'rec_003',
    customer_name: 'Starlight Philippines Inc.',
    bill_to: 'Starlight Philippines Inc.',
    company_name: 'Feilong Business Service (Shenzhen) Co., Ltd',
    service: 'Payroll Processing',
    service_period: '2026-03',
    price: 5000,
    qty: 1,
    discount_percent: 5,
    chinese_translation: '薪资代发服务',
    remark: 'Monthly',
    currency: '¥',
    status: 'active',
  },
];

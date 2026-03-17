/**
 * 飞书多维表格适配器（后端）
 *
 * 后端不直接读写飞书 Bitable — 前端通过 JS SDK 读取数据并发送给后端 API。
 * 写回操作也由前端 JS SDK 完成。
 *
 * 后端适配器仅用于 mock 模式下提供测试数据，
 * 以及在生成账单后执行日志记录。
 */

import type { SourceItem, Invoice, InvoiceItem } from "../types";

export interface FeishuAdapter {
  /** 读取选中的源项目记录 */
  getSelectedSourceItems(): Promise<SourceItem[]>;

  /** 将账单主数据写入（real 模式下由前端 SDK 处理） */
  writeInvoice(invoice: Invoice): Promise<void>;

  /** 将账单明细写入（real 模式下由前端 SDK 处理） */
  writeInvoiceItems(items: InvoiceItem[]): Promise<void>;

  /** 将 html_url / pdf_url 回写（real 模式下由前端 SDK 处理） */
  updateInvoiceUrls(
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void>;
}

/** Mock 适配器 - 用于本地开发和测试 */
export class MockFeishuAdapter implements FeishuAdapter {
  async getSelectedSourceItems(): Promise<SourceItem[]> {
    return MOCK_SOURCE_ITEMS;
  }

  async writeInvoice(invoice: Invoice): Promise<void> {
    console.log("[MockFeishu] writeInvoice:", invoice.invoice_no);
  }

  async writeInvoiceItems(items: InvoiceItem[]): Promise<void> {
    console.log("[MockFeishu] writeInvoiceItems:", items.length, "items");
  }

  async updateInvoiceUrls(
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void> {
    console.log("[MockFeishu] updateInvoiceUrls:", invoiceNo, htmlUrl, pdfUrl);
  }
}

/**
 * Real 模式适配器
 * 后端在 real 模式下不需要读写 Bitable（由前端 SDK 负责）。
 * 这里仅做日志记录。
 */
export class RealFeishuAdapter implements FeishuAdapter {
  async getSelectedSourceItems(): Promise<SourceItem[]> {
    // In real mode, frontend sends items via API — this is not called
    console.log("[RealFeishu] getSelectedSourceItems called — items come from frontend SDK");
    return [];
  }

  async writeInvoice(invoice: Invoice): Promise<void> {
    console.log("[RealFeishu] Invoice generated:", invoice.invoice_no, "— write-back handled by frontend SDK");
  }

  async writeInvoiceItems(items: InvoiceItem[]): Promise<void> {
    console.log("[RealFeishu] Invoice items:", items.length, "— write-back handled by frontend SDK");
  }

  async updateInvoiceUrls(
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void> {
    console.log("[RealFeishu] URLs:", invoiceNo, htmlUrl, pdfUrl, "— write-back handled by frontend SDK");
  }
}

/** 创建适配器实例 */
export function createFeishuAdapter(): FeishuAdapter {
  const useMock = process.env.FEISHU_MODE !== "real";
  if (useMock) {
    console.log("[FeishuAdapter] Using MOCK mode");
    return new MockFeishuAdapter();
  }
  console.log("[FeishuAdapter] Using REAL mode — Bitable read/write handled by frontend SDK");
  return new RealFeishuAdapter();
}

// ============================================================
// Mock 数据
// ============================================================
export const MOCK_SOURCE_ITEMS: SourceItem[] = [
  {
    record_id: "rec_001",
    customer_name: "Starlight Philippines Inc.",
    bill_to: "Starlight Philippines Inc.",
    company_name: "Feilong Business Service (Shenzhen) Co., Ltd",
    service: "Recruitment Service - Senior Developer",
    service_period: "2026-01 ~ 2026-03",
    price: 15000,
    qty: 1,
    discount_percent: 0,
    chinese_translation: "高级开发人员招聘服务",
    remark: "Onsite",
    currency: "¥",
    status: "active",
  },
  {
    record_id: "rec_002",
    customer_name: "Starlight Philippines Inc.",
    bill_to: "Starlight Philippines Inc.",
    company_name: "Feilong Business Service (Shenzhen) Co., Ltd",
    service: "HR Outsourcing Service",
    service_period: "2026-03",
    price: 8000,
    qty: 3,
    discount_percent: 10,
    chinese_translation: "人力资源外包服务",
    remark: "",
    currency: "¥",
    status: "active",
  },
  {
    record_id: "rec_003",
    customer_name: "Starlight Philippines Inc.",
    bill_to: "Starlight Philippines Inc.",
    company_name: "Feilong Business Service (Shenzhen) Co., Ltd",
    service: "Payroll Processing",
    service_period: "2026-03",
    price: 5000,
    qty: 1,
    discount_percent: 5,
    chinese_translation: "薪资代发服务",
    remark: "Monthly",
    currency: "¥",
    status: "active",
  },
];

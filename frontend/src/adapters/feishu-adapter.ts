/**
 * 前端飞书适配器
 *
 * 封装飞书 Bitable Extension SDK 调用。
 * 开发阶段使用 mock，后续替换为真实 SDK。
 */

import type { SourceItem } from "../types";
import { getMockSourceItems } from "../services/api";
import { FEISHU_MODE } from "../config";

export interface FrontendFeishuAdapter {
  getSelectedRecords(): Promise<SourceItem[]>;

  /** Write invoice URL back to source records in Bitable */
  writeBackInvoiceUrls(
    recordIds: string[],
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void>;
}

/** Mock 适配器 - 从后端 API 获取 mock 数据 */
class MockFrontendAdapter implements FrontendFeishuAdapter {
  async getSelectedRecords(): Promise<SourceItem[]> {
    return getMockSourceItems();
  }

  async writeBackInvoiceUrls(
    recordIds: string[],
    invoiceNo: string,
    htmlUrl: string,
    _pdfUrl: string,
  ): Promise<void> {
    console.log(
      "[MockFrontend] writeBackInvoiceUrls:",
      invoiceNo,
      htmlUrl,
      "records:",
      recordIds.length,
    );
  }
}

/**
 * Field name alias mapping.
 * Maps various Bitable column names (Chinese or English variants)
 * to the canonical keys used by SourceItem.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  bill_to: ["bill_to", "bill to", "客户", "客户名称", "收票方"],
  company_name: ["company_name", "company name", "公司名称", "公司", "开票方"],
  service: ["service", "服务", "服务内容", "服务项目", "项目"],
  service_period: ["service_period", "service period", "服务期间", "服务周期", "周期", "期间"],
  price: ["price", "价格", "单价", "金额"],
  qty: ["qty", "quantity", "数量"],
  discount_percent: ["discount_percent", "discount", "折扣", "折扣率", "折扣(%)"],
  chinese_translation: ["chinese_translation", "中文翻译", "中文", "翻译"],
  remark: ["remark", "备注", "说明", "remarks", "note", "notes"],
  currency: ["currency", "币种", "货币"],
};

/** Normalize a field name for matching: lowercase, trim, replace spaces with _ */
function normalizeFieldName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Map raw Bitable field names to canonical SourceItem keys.
 * Tries exact match first, then alias matching.
 */
function mapFieldNames(
  rawFields: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Build a lookup: normalized alias → canonical key
  const aliasToCanonical = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      aliasToCanonical.set(normalizeFieldName(alias), canonical);
    }
  }

  for (const [rawName, value] of Object.entries(rawFields)) {
    const normalized = normalizeFieldName(rawName);

    // Try direct canonical match
    if (FIELD_ALIASES[normalized]) {
      result[normalized] = value;
      continue;
    }

    // Try alias match
    const canonical = aliasToCanonical.get(normalized);
    if (canonical && !(canonical in result)) {
      result[canonical] = value;
    }
  }

  return result;
}

/**
 * 真实飞书适配器
 * 使用 @lark-opdev/block-bitable-api 读取/写入多维表格
 * (feishu-block 扩展环境下的官方 SDK)
 */
class RealFrontendAdapter implements FrontendFeishuAdapter {
  private async getTable() {
    const { bitable } = await import("@lark-opdev/block-bitable-api");
    const selection = await bitable.base.getSelection();
    if (!selection.tableId)
      throw new Error("无法读取当前表格，请确保在多维表格中打开");
    const table = await bitable.base.getTableById(selection.tableId);
    return { bitable, selection, table };
  }

  async getSelectedRecords(): Promise<SourceItem[]> {
    const { selection, table } = await this.getTable();

    // Build field ID → field name mapping
    const fieldMetaList = await table.getFieldMetaList();
    const fieldNameById = new Map(fieldMetaList.map((f) => [f.id, f.name]));

    // Log actual field names for debugging
    const fieldNames = fieldMetaList.map((f) => f.name);
    console.log("[RealFrontend] Table fields:", JSON.stringify(fieldNames));

    // Determine which record IDs to fetch
    let recordIds: string[];
    if (selection.recordId) {
      recordIds = [selection.recordId];
    } else {
      const ids = await table.getRecordIdList();
      recordIds = ids.filter((id): id is string => id != null);
    }

    const items: SourceItem[] = [];
    for (const id of recordIds) {
      const record = await table.getRecordById(id);
      const rawFields = extractFields(record.fields, fieldNameById);
      const mapped = mapFieldNames(rawFields);

      // Log first record for debugging
      if (items.length === 0) {
        console.log("[RealFrontend] Raw field names:", Object.keys(rawFields));
        console.log("[RealFrontend] Mapped fields:", JSON.stringify(mapped));
      }

      items.push({
        record_id: id,
        bill_to: String(mapped["bill_to"] ?? ""),
        company_name: String(mapped["company_name"] ?? ""),
        customer_name: String(mapped["bill_to"] ?? ""),
        service: String(mapped["service"] ?? ""),
        service_period: String(mapped["service_period"] ?? ""),
        price: Number(mapped["price"]) || 0,
        qty: Number(mapped["qty"]) || 1,
        discount_percent: Number(mapped["discount_percent"]) || 0,
        chinese_translation: String(mapped["chinese_translation"] ?? ""),
        remark: String(mapped["remark"] ?? ""),
        currency: String(mapped["currency"] ?? "¥"),
        status: "active",
      });
    }

    return items;
  }

  async writeBackInvoiceUrls(
    recordIds: string[],
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void> {
    const { table } = await this.getTable();

    // Get field meta to find/create the write-back fields
    const fieldMetaList = await table.getFieldMetaList();
    const fieldByName = new Map(fieldMetaList.map((f) => [f.name, f.id]));

    // Resolve field IDs for write-back columns
    const invoiceNoFieldId = fieldByName.get("invoice_no");
    const htmlUrlFieldId = fieldByName.get("html_url");
    const pdfUrlFieldId = fieldByName.get("pdf_url");

    if (!invoiceNoFieldId && !htmlUrlFieldId && !pdfUrlFieldId) {
      console.warn(
        "[RealFrontend] No write-back fields found (invoice_no, html_url, pdf_url). Skipping write-back.",
      );
      return;
    }

    // Update each source record with invoice links
    for (const recordId of recordIds) {
      const fields: Record<string, unknown> = {};

      if (invoiceNoFieldId) {
        fields[invoiceNoFieldId] = invoiceNo;
      }
      if (htmlUrlFieldId) {
        fields[htmlUrlFieldId] = htmlUrl;
      }
      if (pdfUrlFieldId) {
        fields[pdfUrlFieldId] = pdfUrl;
      }

      await table.setRecord(recordId, { fields });
    }

    console.log(
      "[RealFrontend] writeBackInvoiceUrls:",
      invoiceNo,
      "updated",
      recordIds.length,
      "records",
    );
  }
}

/** Extract a flat { fieldName: value } map from a Bitable record */
function extractFields(
  fields: Record<string, unknown>,
  fieldNameById: Map<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(fields)) {
    const name = fieldNameById.get(fieldId);
    if (!name) continue;

    // Bitable text fields return [{ text: "..." }], numbers return number
    if (Array.isArray(value)) {
      result[name] = value
        .map((v: Record<string, unknown>) =>
          typeof v === "object" && v !== null
            ? String(v.text ?? "")
            : String(v),
        )
        .join("");
    } else {
      result[name] = value;
    }
  }
  return result;
}

export function createFrontendAdapter(): FrontendFeishuAdapter {
  if (FEISHU_MODE === "real") {
    return new RealFrontendAdapter();
  }
  return new MockFrontendAdapter();
}

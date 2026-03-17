/**
 * 前端飞书适配器
 *
 * 封装飞书 Bitable Extension SDK 调用。
 * 开发阶段使用 mock，后续替换为真实 SDK。
 *
 * 数据模型：
 * - 工单主表：客户信息 + 关联服务ID（链接到服务报价表）
 * - 服务报价表：服务明细（服务内容、价格、数量、折扣等）
 */

import type { SourceItem } from "../types";
import { getMockSourceItems } from "../services/api";
import { FEISHU_MODE } from "../config";

export interface FrontendFeishuAdapter {
  getSelectedRecords(): Promise<SourceItem[]>;

  /** The main table record IDs that were read (for write-back) */
  getMainRecordIds(): string[];

  /** Write invoice URL back to source records in Bitable */
  writeBackInvoiceUrls(
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

  getMainRecordIds(): string[] {
    return [];
  }

  async writeBackInvoiceUrls(
    invoiceNo: string,
    htmlUrl: string,
    _pdfUrl: string,
  ): Promise<void> {
    console.log("[MockFrontend] writeBackInvoiceUrls:", invoiceNo, htmlUrl);
  }
}

// ============================================================
// 工单主表 field name constants
// ============================================================
const MAIN_TABLE_FIELDS = {
  /** 客户名称 / Bill To — 联系人姓名 */
  CUSTOMER_NAME: "联系人姓名",
  /** 客户微信名称 (fallback for bill_to) */
  WECHAT_NAME: "客户微信名称",
  /** 关联到服务报价表的链接字段 */
  LINKED_SERVICE: "关联服务ID",
  /** 账单ID — write-back field */
  INVOICE_ID: "账单ID",
  /** 账单附件 — write-back field */
  INVOICE_ATTACHMENT: "账单附件",
} as const;

// ============================================================
// 服务报价表 field name constants
// ============================================================
const SERVICE_TABLE_FIELDS = {
  EXPENSE_ID: "费用ID",
  SERVICE: "服务内容",
  SERVICE_PERIOD: "服务期限",
  PRICE: "价格",
  QTY: "数量",
  DISCOUNT: "折扣%",
  TOTAL: "合计",
  CHINESE_TRANSLATION: "中文翻译",
  REMARK: "备注",
} as const;

/**
 * 真实飞书适配器
 *
 * 读取流程：
 * 1. 从工单主表读取选中记录，获取客户信息
 * 2. 通过「关联服务ID」链接字段，找到服务报价表的关联记录
 * 3. 读取每条服务报价记录，组装为 SourceItem[]
 */
class RealFrontendAdapter implements FrontendFeishuAdapter {
  /** Stores main table record IDs from last getSelectedRecords call */
  private _mainRecordIds: string[] = [];

  getMainRecordIds(): string[] {
    return [...this._mainRecordIds];
  }

  private async getBitable() {
    const { bitable } = await import("@lark-opdev/block-bitable-api");
    return bitable;
  }

  private async getMainTable() {
    const bitable = await this.getBitable();
    const selection = await bitable.base.getSelection();
    if (!selection.tableId)
      throw new Error("无法读取当前表格，请确保在多维表格中打开");
    const table = await bitable.base.getTableById(selection.tableId);
    return { bitable, selection, table };
  }

  async getSelectedRecords(): Promise<SourceItem[]> {
    const { bitable, selection, table } = await this.getMainTable();

    // Build field ID → name mapping for 工单主表
    const mainFieldMeta = await table.getFieldMetaList();
    const mainFieldNameById = new Map(mainFieldMeta.map((f) => [f.id, f.name]));
    const mainFieldIdByName = new Map(mainFieldMeta.map((f) => [f.name, f.id]));

    console.log(
      "[RealFrontend] 工单主表 fields:",
      JSON.stringify(mainFieldMeta.map((f) => f.name)),
    );

    // Determine which record IDs to fetch from 工单主表
    let mainRecordIds: string[];
    if (selection.recordId) {
      mainRecordIds = [selection.recordId];
    } else {
      const ids = await table.getRecordIdList();
      mainRecordIds = ids.filter((id): id is string => id != null);
    }

    // Store main record IDs for write-back
    this._mainRecordIds = mainRecordIds;

    // Find the linked service field
    const linkedServiceFieldId = mainFieldIdByName.get(
      MAIN_TABLE_FIELDS.LINKED_SERVICE,
    );

    if (!linkedServiceFieldId) {
      console.warn(
        "[RealFrontend] 找不到「关联服务ID」字段，尝试回退到单表模式",
      );
      return this.fallbackSingleTableRead(
        mainRecordIds,
        table,
        mainFieldNameById,
      );
    }

    // Find the linked table (服务报价表)
    const linkedFieldMeta = mainFieldMeta.find(
      (f) => f.name === MAIN_TABLE_FIELDS.LINKED_SERVICE,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkedTableId = (linkedFieldMeta as any)?.property?.tableId;

    if (!linkedTableId) {
      console.warn("[RealFrontend] 无法获取关联表格ID，回退到单表模式");
      return this.fallbackSingleTableRead(
        mainRecordIds,
        table,
        mainFieldNameById,
      );
    }

    let serviceTable;
    try {
      serviceTable = await bitable.base.getTableById(linkedTableId);
    } catch (err) {
      console.error("[RealFrontend] 无法打开服务报价表:", err);
      return this.fallbackSingleTableRead(
        mainRecordIds,
        table,
        mainFieldNameById,
      );
    }

    // Build field mappings for 服务报价表
    const serviceFieldMeta = await serviceTable.getFieldMetaList();
    const serviceFieldNameById = new Map(
      serviceFieldMeta.map((f) => [f.id, f.name]),
    );

    console.log(
      "[RealFrontend] 服务报价表 fields:",
      JSON.stringify(serviceFieldMeta.map((f) => f.name)),
    );

    // Process each main record
    const allItems: SourceItem[] = [];

    for (const mainRecordId of mainRecordIds) {
      const mainRecord = await table.getRecordById(mainRecordId);
      const mainFields = extractFields(mainRecord.fields, mainFieldNameById);

      // Extract customer info from main record
      const customerName =
        String(mainFields[MAIN_TABLE_FIELDS.CUSTOMER_NAME] ?? "") ||
        String(mainFields[MAIN_TABLE_FIELDS.WECHAT_NAME] ?? "");

      console.log(
        "[RealFrontend] 工单主表 record:",
        mainRecordId,
        "客户:",
        customerName,
      );

      // Get linked service record IDs
      const linkedValue = mainRecord.fields[linkedServiceFieldId];
      const linkedRecordIds = extractLinkedRecordIds(linkedValue);

      console.log(
        "[RealFrontend] 关联服务记录数:",
        linkedRecordIds.length,
        linkedRecordIds,
      );

      // Read each linked service record
      for (const serviceRecordId of linkedRecordIds) {
        try {
          const serviceRecord =
            await serviceTable.getRecordById(serviceRecordId);
          const svcFields = extractFields(
            serviceRecord.fields,
            serviceFieldNameById,
          );

          const price = parseNumber(svcFields[SERVICE_TABLE_FIELDS.PRICE]);
          const qty = parseNumber(svcFields[SERVICE_TABLE_FIELDS.QTY]) || 1;
          const discountRaw = svcFields[SERVICE_TABLE_FIELDS.DISCOUNT];
          const discountPercent = parseDiscountPercent(discountRaw);

          const item: SourceItem = {
            record_id: serviceRecordId,
            bill_to: customerName,
            customer_name: customerName,
            company_name: "",
            service: String(svcFields[SERVICE_TABLE_FIELDS.SERVICE] ?? ""),
            service_period: String(
              svcFields[SERVICE_TABLE_FIELDS.SERVICE_PERIOD] ?? "",
            ),
            price,
            qty,
            discount_percent: discountPercent,
            chinese_translation: String(
              svcFields[SERVICE_TABLE_FIELDS.CHINESE_TRANSLATION] ?? "",
            ),
            remark: String(svcFields[SERVICE_TABLE_FIELDS.REMARK] ?? ""),
            currency: "¥",
            status: "active",
          };

          allItems.push(item);
        } catch (err) {
          console.warn(
            "[RealFrontend] 读取服务记录失败:",
            serviceRecordId,
            err,
          );
        }
      }
    }

    console.log("[RealFrontend] 共读取服务项:", allItems.length);
    return allItems;
  }

  /**
   * 回退单表模式：当找不到关联字段时，直接从当前表读取
   */
  private async fallbackSingleTableRead(
    recordIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    fieldNameById: Map<string, string>,
  ): Promise<SourceItem[]> {
    const items: SourceItem[] = [];
    for (const id of recordIds) {
      const record = await table.getRecordById(id);
      const fields = extractFields(record.fields, fieldNameById);

      items.push({
        record_id: id,
        bill_to: String(
          fields[MAIN_TABLE_FIELDS.CUSTOMER_NAME] ??
            fields[MAIN_TABLE_FIELDS.WECHAT_NAME] ??
            "",
        ),
        company_name: "",
        customer_name: String(
          fields[MAIN_TABLE_FIELDS.CUSTOMER_NAME] ??
            fields[MAIN_TABLE_FIELDS.WECHAT_NAME] ??
            "",
        ),
        service: String(fields[SERVICE_TABLE_FIELDS.SERVICE] ?? ""),
        service_period: String(
          fields[SERVICE_TABLE_FIELDS.SERVICE_PERIOD] ?? "",
        ),
        price: parseNumber(fields[SERVICE_TABLE_FIELDS.PRICE]),
        qty: parseNumber(fields[SERVICE_TABLE_FIELDS.QTY]) || 1,
        discount_percent: parseDiscountPercent(
          fields[SERVICE_TABLE_FIELDS.DISCOUNT],
        ),
        chinese_translation: String(
          fields[SERVICE_TABLE_FIELDS.CHINESE_TRANSLATION] ?? "",
        ),
        remark: String(fields[SERVICE_TABLE_FIELDS.REMARK] ?? ""),
        currency: "¥",
        status: "active",
      });
    }
    return items;
  }

  async writeBackInvoiceUrls(
    invoiceNo: string,
    htmlUrl: string,
    pdfUrl: string,
  ): Promise<void> {
    const { table } = await this.getMainTable();

    // Use stored main record IDs (from getSelectedRecords)
    const recordIds = this._mainRecordIds;
    if (recordIds.length === 0) {
      console.warn("[RealFrontend] No main record IDs stored for write-back");
      return;
    }

    // Get field meta to find write-back fields
    const fieldMetaList = await table.getFieldMetaList();
    const fieldByName = new Map(fieldMetaList.map((f) => [f.name, f.id]));

    console.log(
      "[RealFrontend] Write-back: available fields:",
      JSON.stringify(fieldMetaList.map((f) => f.name)),
    );

    // Try Chinese field names for write-back
    const invoiceIdFieldId =
      fieldByName.get("账单编号") ??
      fieldByName.get(MAIN_TABLE_FIELDS.INVOICE_ID);
    const htmlUrlFieldId =
      fieldByName.get("HTML链接") ?? fieldByName.get("html_url");
    const pdfUrlFieldId =
      fieldByName.get("PDF链接") ?? fieldByName.get("pdf_url");

    console.log("[RealFrontend] Write-back field IDs:", {
      invoiceId: invoiceIdFieldId,
      htmlUrl: htmlUrlFieldId,
      pdfUrl: pdfUrlFieldId,
    });

    if (!invoiceIdFieldId && !htmlUrlFieldId && !pdfUrlFieldId) {
      console.warn(
        "[RealFrontend] No write-back fields found (账单编号, HTML链接, PDF链接). Skipping.",
      );
      return;
    }

    for (const recordId of recordIds) {
      try {
        const fields: Record<string, unknown> = {};

        if (invoiceIdFieldId) {
          fields[invoiceIdFieldId] = invoiceNo;
        }
        if (htmlUrlFieldId) {
          fields[htmlUrlFieldId] = htmlUrl;
        }
        if (pdfUrlFieldId) {
          fields[pdfUrlFieldId] = pdfUrl;
        }

        console.log("[RealFrontend] Writing to record:", recordId, fields);
        await table.setRecord(recordId, { fields });
        console.log("[RealFrontend] Write-back success for:", recordId);
      } catch (err) {
        console.error(
          "[RealFrontend] Write-back failed for record:",
          recordId,
          err,
        );
      }
    }

    console.log(
      "[RealFrontend] writeBackInvoiceUrls complete:",
      invoiceNo,
      "updated",
      recordIds.length,
      "main records",
    );
  }
}

// ============================================================
// Utility functions
// ============================================================

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
      // Check if it's a link field (array of { record_id, text })
      const firstItem = value[0];
      if (
        firstItem &&
        typeof firstItem === "object" &&
        "record_id" in firstItem
      ) {
        // Keep link fields as-is for later processing
        result[name] = value;
      } else {
        result[name] = value
          .map((v: Record<string, unknown>) =>
            typeof v === "object" && v !== null
              ? String(v.text ?? "")
              : String(v),
          )
          .join("");
      }
    } else {
      result[name] = value;
    }
  }
  return result;
}

/**
 * Extract linked record IDs from a Bitable link field value.
 * Link fields can be: { recordIds: string[] } or [{ record_id: string }] etc.
 */
function extractLinkedRecordIds(value: unknown): string[] {
  if (!value) return [];

  // Format: { recordIds: string[], ... }
  if (typeof value === "object" && value !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as any;
    if (Array.isArray(obj.recordIds)) {
      return obj.recordIds;
    }
    if (Array.isArray(obj.record_ids)) {
      return obj.record_ids;
    }
  }

  // Format: [{ record_id: "xxx", text: "..." }, ...]
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj = item as any;
          return obj.record_id ?? obj.recordId ?? obj.id ?? null;
        }
        return null;
      })
      .filter((id): id is string => typeof id === "string");
  }

  console.warn("[RealFrontend] Unknown link field format:", value);
  return [];
}

/** Parse a number from Bitable field value, handling strings and currency */
function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[¥$€,\s]/g, "");
    return Number(cleaned) || 0;
  }
  return 0;
}

/** Parse discount percent — could be "5%", 5, 0.05, etc. */
function parseDiscountPercent(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") {
    // If value < 1, it's probably a decimal (0.05 = 5%)
    return value < 1 ? value * 100 : value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").trim();
    const num = Number(cleaned) || 0;
    return num < 1 ? num * 100 : num;
  }
  return 0;
}

export function createFrontendAdapter(): FrontendFeishuAdapter {
  if (FEISHU_MODE === "real") {
    return new RealFrontendAdapter();
  }
  return new MockFrontendAdapter();
}

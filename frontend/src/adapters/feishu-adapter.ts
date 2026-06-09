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

import type { SourceItem, ExchangeRateRow, Invoice } from "../types";
import { getMockSourceItems } from "../services/api";
import { FEISHU_MODE } from "../config";

export interface FrontendFeishuAdapter {
  getSelectedRecords(): Promise<SourceItem[]>;

  /** The main table record IDs that were read (for write-back) */
  getMainRecordIds(): string[];

  /**
   * Write the generated invoice back onto each main-table record.
   * Targets differ per invoice type; see the MAIN_TABLE_FIELDS aliases.
   */
  writeBackInvoice(invoice: Invoice): Promise<void>;

  /** Read all rows from 汇率表 (if it exists in this base) */
  getExchangeRates(): Promise<ExchangeRateRow[]>;

  /**
   * Subscribe to Bitable selection changes. Returns an unsubscribe fn.
   * No-op on the mock adapter.
   */
  onSelectionChange(cb: () => void): () => void;
}

/** Mock 适配器 - 从后端 API 获取 mock 数据 */
class MockFrontendAdapter implements FrontendFeishuAdapter {
  async getSelectedRecords(): Promise<SourceItem[]> {
    return getMockSourceItems();
  }

  getMainRecordIds(): string[] {
    return [];
  }

  async writeBackInvoice(invoice: Invoice): Promise<void> {
    console.log(
      "[MockFrontend] writeBackInvoice:",
      invoice.invoice_no,
      invoice.invoice_type,
    );
  }

  async getExchangeRates(): Promise<ExchangeRateRow[]> {
    return [];
  }

  onSelectionChange(_cb: () => void): () => void {
    return () => {};
  }
}

// ============================================================
// 工单主表 field aliases (English primary, Chinese fallback)
// ============================================================
const MAIN_TABLE_FIELDS = {
  COMPANY_NAME: ["Company Name", "公司名称"],
  CUSTOMER_NAME: ["Customer Name", "联系人姓名"],
  WECHAT_NAME: ["WeChat Name", "客户微信名称"],
  LINKED_SERVICE: ["Associated Service ID", "关联服务ID"],
  // Main-table identifiers copied onto final_payment invoice rows
  BILL_NUMBER: ["Bill Number", "账单编号"],
  BILLING_DATE: ["Billing Date", "账单日期"],
  // Consultant-invoice write-back targets
  HTML_LINK: ["HTML link", "HTML链接"],
  PDF_LINK: ["PDF link", "PDF链接"],
  ADD_VAT: ["Add:VAT(x%)", "Add:VAT", "VAT Amount", "增值税"],
  LESS_EWT: ["Less:EWT(2%)", "Less:EWT", "EWT Amount", "预扣税"],
  // Final-payment write-back targets
  FINAL_BILL_NUMBER: ["Final Billing Number", "Final Bill Number"],
  FINAL_BILLING_DATE: ["Final Billing Date"],
  FINAL_HTML_LINK: ["Final HTML link"],
  FINAL_PDF_LINK: ["Final PDF link"],
  FINAL_BALANCE: ["Final Balance"],
  // Other main-table reads
  INVOICE_ATTACHMENT: ["Invoice Attachment", "账单附件"],
  AMOUNT_REFUNDED: ["Amount Refunded", "退款金额"],
  TOTAL_DEDUCTION_AMOUNT: ["Total Deduction Amount", "总扣款金额"],
  // Primary "billed-side" currency (covers Amount Billed / Paid / Refunded / Deductible)
  BILL_CURRENCY: ["Bill Currency", "Currency", "币种", "账单币种"],
  // "Final" currency (covers Actual Amount Incurred)
  FINAL_BILL_CURRENCY: ["Final bill currency", "Final Bill Currency"],
} as const;

const EXCHANGE_RATE_TABLE_NAMES = [
  "汇率表",
  "Exchange Rate",
  "Exchange Rates",
  "ExchangeRate",
  "汇率",
];

const EXCHANGE_RATE_FIELDS = {
  EFFECTIVE_DATE: [
    "Effective Date",
    "Date",
    "生效日期",
    "日期",
    "Exchange Date",
  ],
  EXPIRY_DATE: ["Expiry Date", "失效日期", "到期日期"],
  FROM_CURRENCY: [
    "Original currency",
    "Original Currency",
    "From Currency",
    "Source Currency",
    "Base Currency",
    "原币种",
    "源币种",
    "From",
  ],
  TO_CURRENCY: [
    "Target currency",
    "Target Currency",
    "Ttarget currency",
    "To Currency",
    "Quote Currency",
    "目标币种",
    "To",
  ],
  RATE: ["Exchange rate", "Exchange Rate", "Rate", "汇率"],
} as const;

// ============================================================
// 服务报价表 field aliases
// ============================================================
const SERVICE_TABLE_FIELDS = {
  EXPENSE_ID: ["Expense ID", "费用ID"],
  SERVICE: [
    "Service",
    "Service Content",
    "Service Name",
    "Service Description",
    "Item",
    "Item Name",
    "Description",
    "Product",
    "Product Name",
    "服务内容",
    "服务名称",
    "项目",
    "项目名称",
  ],
  SERVICE_PERIOD: [
    "Service Period",
    "Period",
    "Duration",
    "Service Date",
    "Date Range",
    "服务期限",
    "服务期间",
    "期间",
  ],
  PRICE: ["Price", "Unit Price", "价格", "单价"],
  QTY: ["Qty", "Quantity", "数量"],
  DISCOUNT: ["Discount%", "Discount", "折扣%", "折扣"],
  TOTAL: ["Total", "Amount", "Subtotal", "合计", "小计"],
  CHINESE_TRANSLATION: [
    "Chinese Translation",
    "Chinese Name",
    "CN",
    "CN Name",
    "Name (CN)",
    "中文翻译",
    "中文",
    "中文名称",
  ],
  REMARK: [
    "Remark",
    "Remarks",
    "Note",
    "Notes",
    "Comment",
    "Comments",
    "Memo",
    "备注",
    "注释",
  ],
  TAXATION_IDENTIFICATION: [
    "Taxation Identification",
    "Tax Identification",
    "Taxable",
    "纳税标识",
    "是否纳税",
  ],
  ACTUAL_AMOUNT_INCURRED: [
    "Actual Amount Incurred",
    "Actual Amount",
    "实际发生金额",
    "实际金额",
  ],
  AMOUNT_PAID: [
    "Amount Paid",
    "Paid Amount",
    "Received Amount",
    "已付金额",
    "已支付金额",
    "已收款",
  ],
} as const;

/** Find the first alias that exists as a key in the map; returns its value. */
function firstId(
  idByName: Map<string, string>,
  aliases: readonly string[],
): string | undefined {
  for (const name of aliases) {
    const id = idByName.get(name);
    if (id !== undefined) return id;
  }
  return undefined;
}

/** Find the first alias that has a non-empty value in the field map. */
function firstValue(
  fields: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  for (const name of aliases) {
    const v = fields[name];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Check if a meta field name matches any of the aliases. */
function nameMatches(name: string, aliases: readonly string[]): boolean {
  return aliases.includes(name);
}

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

  onSelectionChange(cb: () => void): () => void {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void this.getBitable().then((bitable) => {
      if (cancelled) return;
      try {
        // Bitable returns a dispose function that removes the listener.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dispose = (bitable.base as any).onSelectionChange(() => cb());
        if (typeof dispose === "function") {
          unsubscribe = dispose;
        }
      } catch (err) {
        console.warn("[RealFrontend] onSelectionChange failed:", err);
      }
    });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
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
    const linkedServiceFieldId = firstId(
      mainFieldIdByName,
      MAIN_TABLE_FIELDS.LINKED_SERVICE,
    );

    if (!linkedServiceFieldId) {
      console.warn(
        "[RealFrontend] 未找到关联服务字段 (tried:",
        MAIN_TABLE_FIELDS.LINKED_SERVICE,
        "), 回退到单表模式",
      );
      return this.fallbackSingleTableRead(
        mainRecordIds,
        table,
        mainFieldNameById,
      );
    }

    // Find the linked table (服务报价表)
    const linkedFieldMeta = mainFieldMeta.find((f) =>
      nameMatches(f.name, MAIN_TABLE_FIELDS.LINKED_SERVICE),
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

      // Extract customer info: company → contact → wechat
      const companyNameVal = String(
        firstValue(mainFields, MAIN_TABLE_FIELDS.COMPANY_NAME) ?? "",
      ).trim();
      const contactName = String(
        firstValue(mainFields, MAIN_TABLE_FIELDS.CUSTOMER_NAME) ?? "",
      ).trim();
      const wechatName = String(
        firstValue(mainFields, MAIN_TABLE_FIELDS.WECHAT_NAME) ?? "",
      ).trim();
      const customerName = companyNameVal || contactName || wechatName;

      // Main-record numeric context for 尾款账单
      const mainAmountRefunded = parseNumber(
        firstValue(mainFields, MAIN_TABLE_FIELDS.AMOUNT_REFUNDED),
      );
      const mainTotalDeduction = parseNumber(
        firstValue(mainFields, MAIN_TABLE_FIELDS.TOTAL_DEDUCTION_AMOUNT),
      );
      const mainBillNumber = String(
        firstValue(mainFields, MAIN_TABLE_FIELDS.BILL_NUMBER) ?? "",
      ).trim();
      const mainBillingDate = toIsoDate(
        firstValue(mainFields, MAIN_TABLE_FIELDS.BILLING_DATE),
      );

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
      let loggedRawSample = false;
      for (const serviceRecordId of linkedRecordIds) {
        try {
          const serviceRecord =
            await serviceTable.getRecordById(serviceRecordId);
          if (!loggedRawSample) {
            console.log(
              "[RealFrontend] raw service record sample (first):",
              JSON.stringify(serviceRecord.fields).slice(0, 2000),
            );
            loggedRawSample = true;
          }
          const svcFields = extractFields(
            serviceRecord.fields,
            serviceFieldNameById,
          );
          console.log(
            "[RealFrontend] normalized service fields:",
            JSON.stringify(svcFields).slice(0, 1000),
          );

          const price = parseNumber(
            firstValue(svcFields, SERVICE_TABLE_FIELDS.PRICE),
          );
          const qty =
            parseNumber(firstValue(svcFields, SERVICE_TABLE_FIELDS.QTY)) || 1;
          const discountRaw = firstValue(
            svcFields,
            SERVICE_TABLE_FIELDS.DISCOUNT,
          );
          const discountPercent = parseDiscountPercent(discountRaw);

          const item: SourceItem = {
            record_id: serviceRecordId,
            bill_to: companyNameVal || contactName || wechatName,
            customer_name: contactName || wechatName,
            company_name: companyNameVal,
            service: String(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.SERVICE) ?? "",
            ),
            service_period: String(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.SERVICE_PERIOD) ?? "",
            ),
            price,
            qty,
            discount_percent: discountPercent,
            chinese_translation: String(
              firstValue(
                svcFields,
                SERVICE_TABLE_FIELDS.CHINESE_TRANSLATION,
              ) ?? "",
            ),
            remark: String(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.REMARK) ?? "",
            ),
            currency: "¥",
            status: "active",
            tax_eligible: parseYesNo(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.TAXATION_IDENTIFICATION),
            ),
            actual_amount_incurred: parseNumber(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.ACTUAL_AMOUNT_INCURRED),
            ),
            amount_paid: parseNumber(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.AMOUNT_PAID),
            ),
            amount_billed: parseNumber(
              firstValue(svcFields, SERVICE_TABLE_FIELDS.TOTAL),
            ),
            bill_number: mainBillNumber || undefined,
            billing_date: mainBillingDate || undefined,
            amount_refunded: mainAmountRefunded,
            total_deduction_amount: mainTotalDeduction,
            source_currency: String(
              firstValue(mainFields, MAIN_TABLE_FIELDS.BILL_CURRENCY) ?? "",
            ).trim() || undefined,
            final_currency: String(
              firstValue(mainFields, MAIN_TABLE_FIELDS.FINAL_BILL_CURRENCY) ?? "",
            ).trim() || undefined,
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

      const fallbackCompany = String(
        firstValue(fields, MAIN_TABLE_FIELDS.COMPANY_NAME) ?? "",
      ).trim();
      const fallbackContact = String(
        firstValue(fields, MAIN_TABLE_FIELDS.CUSTOMER_NAME) ?? "",
      ).trim();
      const fallbackWechat = String(
        firstValue(fields, MAIN_TABLE_FIELDS.WECHAT_NAME) ?? "",
      ).trim();
      const fallbackBillTo =
        fallbackCompany || fallbackContact || fallbackWechat;

      items.push({
        record_id: id,
        bill_to: fallbackBillTo,
        company_name: fallbackCompany,
        customer_name: fallbackContact || fallbackWechat,
        service: String(
          firstValue(fields, SERVICE_TABLE_FIELDS.SERVICE) ?? "",
        ),
        service_period: String(
          firstValue(fields, SERVICE_TABLE_FIELDS.SERVICE_PERIOD) ?? "",
        ),
        price: parseNumber(firstValue(fields, SERVICE_TABLE_FIELDS.PRICE)),
        qty:
          parseNumber(firstValue(fields, SERVICE_TABLE_FIELDS.QTY)) || 1,
        discount_percent: parseDiscountPercent(
          firstValue(fields, SERVICE_TABLE_FIELDS.DISCOUNT),
        ),
        chinese_translation: String(
          firstValue(fields, SERVICE_TABLE_FIELDS.CHINESE_TRANSLATION) ?? "",
        ),
        remark: String(
          firstValue(fields, SERVICE_TABLE_FIELDS.REMARK) ?? "",
        ),
        currency: "¥",
        status: "active",
        tax_eligible: parseYesNo(
          firstValue(fields, SERVICE_TABLE_FIELDS.TAXATION_IDENTIFICATION),
        ),
        actual_amount_incurred: parseNumber(
          firstValue(fields, SERVICE_TABLE_FIELDS.ACTUAL_AMOUNT_INCURRED),
        ),
        amount_paid: parseNumber(
          firstValue(fields, SERVICE_TABLE_FIELDS.AMOUNT_PAID),
        ),
        amount_billed: parseNumber(
          firstValue(fields, SERVICE_TABLE_FIELDS.TOTAL),
        ),
        bill_number:
          String(
            firstValue(fields, MAIN_TABLE_FIELDS.BILL_NUMBER) ?? "",
          ).trim() || undefined,
        billing_date:
          toIsoDate(firstValue(fields, MAIN_TABLE_FIELDS.BILLING_DATE)) ||
          undefined,
        amount_refunded: parseNumber(
          firstValue(fields, MAIN_TABLE_FIELDS.AMOUNT_REFUNDED),
        ),
        total_deduction_amount: parseNumber(
          firstValue(fields, MAIN_TABLE_FIELDS.TOTAL_DEDUCTION_AMOUNT),
        ),
        source_currency: String(
          firstValue(fields, MAIN_TABLE_FIELDS.BILL_CURRENCY) ?? "",
        ).trim() || undefined,
        final_currency: String(
          firstValue(fields, MAIN_TABLE_FIELDS.FINAL_BILL_CURRENCY) ?? "",
        ).trim() || undefined,
      });
    }
    return items;
  }

  async getExchangeRates(): Promise<ExchangeRateRow[]> {
    const bitable = await this.getBitable();
    // getTableMetaList exists at runtime but is missing from this package's
    // typings. Cast to any locally.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableMetaList: Array<{ id: string; name: string }> = await (
      bitable.base as any
    ).getTableMetaList();
    const rateTableMeta = tableMetaList.find((t: { name: string }) =>
      EXCHANGE_RATE_TABLE_NAMES.some((n) => t.name === n),
    );
    if (!rateTableMeta) {
      console.warn(
        "[RealFrontend] 汇率表 not found. Tables available:",
        tableMetaList.map((t: { name: string }) => t.name),
      );
      return [];
    }

    const table = await bitable.base.getTableById(rateTableMeta.id);
    const fieldMeta = await table.getFieldMetaList();
    const idByName = new Map(fieldMeta.map((f) => [f.name, f.id]));
    const nameById = new Map(fieldMeta.map((f) => [f.id, f.name]));

    const recordIds = (await table.getRecordIdList()).filter(
      (id): id is string => id != null,
    );

    const rows: ExchangeRateRow[] = [];
    for (const id of recordIds) {
      try {
        const rec = await table.getRecordById(id);
        const f = extractFields(rec.fields, nameById);
        const effective = toIsoDate(
          firstValue(f, EXCHANGE_RATE_FIELDS.EFFECTIVE_DATE),
        );
        const expiry = toIsoDate(
          firstValue(f, EXCHANGE_RATE_FIELDS.EXPIRY_DATE),
        );
        const from = String(
          firstValue(f, EXCHANGE_RATE_FIELDS.FROM_CURRENCY) ?? "",
        )
          .trim()
          .toUpperCase();
        const to = String(
          firstValue(f, EXCHANGE_RATE_FIELDS.TO_CURRENCY) ?? "",
        )
          .trim()
          .toUpperCase();
        const rate = parseNumber(firstValue(f, EXCHANGE_RATE_FIELDS.RATE));
        if (from && to && rate > 0) {
          rows.push({
            effective_date: effective,
            expiry_date: expiry || undefined,
            from_currency: from,
            to_currency: to,
            rate,
          });
        }
      } catch (err) {
        console.warn("[RealFrontend] 读取汇率行失败:", id, err);
      }
    }
    // suppress unused-var warning for idByName
    void idByName;
    console.log(
      "[RealFrontend] 汇率表 rows:",
      rows.length,
      rows
        .slice(0, 10)
        .map(
          (r) =>
            `${r.from_currency}→${r.to_currency}=${r.rate} [${r.effective_date}..${r.expiry_date ?? "∞"}]`,
        ),
    );
    return rows;
  }

  async writeBackInvoice(invoice: Invoice): Promise<void> {
    const { table } = await this.getMainTable();

    const recordIds = this._mainRecordIds;
    if (recordIds.length === 0) {
      console.warn("[RealFrontend] No main record IDs stored for write-back");
      return;
    }

    const fieldMetaList = await table.getFieldMetaList();
    const fieldByName = new Map(fieldMetaList.map((f) => [f.name, f.id]));

    console.log(
      "[RealFrontend] Write-back: available fields:",
      JSON.stringify(fieldMetaList.map((f) => f.name)),
    );

    // Build the field → value map based on invoice_type.
    const updates: Record<string, unknown> = {};
    const put = (aliases: readonly string[], value: unknown): void => {
      const id = firstId(fieldByName, aliases);
      if (id) updates[id] = value;
    };

    // Bitable Date fields expect a millisecond timestamp, not a string.
    const dateMs = (iso: string): number => {
      // Use noon UTC to avoid off-by-one in local time zones
      const d = new Date(`${iso}T12:00:00Z`);
      const t = d.getTime();
      return Number.isNaN(t) ? Date.now() : t;
    };

    if (invoice.invoice_type === "final_payment") {
      put(MAIN_TABLE_FIELDS.FINAL_BILL_NUMBER, invoice.invoice_no);
      put(MAIN_TABLE_FIELDS.FINAL_BILLING_DATE, dateMs(invoice.invoice_date));
      put(MAIN_TABLE_FIELDS.FINAL_HTML_LINK, invoice.html_url ?? "");
      put(MAIN_TABLE_FIELDS.FINAL_PDF_LINK, invoice.pdf_url ?? "");
      put(
        MAIN_TABLE_FIELDS.FINAL_BALANCE,
        invoice.final_balance ?? invoice.grand_total,
      );
    } else {
      put(MAIN_TABLE_FIELDS.BILL_NUMBER, invoice.invoice_no);
      put(MAIN_TABLE_FIELDS.BILLING_DATE, dateMs(invoice.invoice_date));
      put(MAIN_TABLE_FIELDS.HTML_LINK, invoice.html_url ?? "");
      put(MAIN_TABLE_FIELDS.PDF_LINK, invoice.pdf_url ?? "");
      put(MAIN_TABLE_FIELDS.ADD_VAT, invoice.vat_amount);
      put(MAIN_TABLE_FIELDS.LESS_EWT, invoice.ewt_amount ?? 0);
    }

    console.log("[RealFrontend] Write-back targets:", Object.keys(updates));

    if (Object.keys(updates).length === 0) {
      console.warn(
        "[RealFrontend] No matching write-back fields on main table. Skipping.",
      );
      return;
    }

    for (const recordId of recordIds) {
      try {
        await table.setRecord(recordId, { fields: updates });
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
      "[RealFrontend] writeBackInvoice complete:",
      invoice.invoice_no,
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

    // Preserve link field arrays for extractLinkedRecordIds
    if (Array.isArray(value)) {
      const firstItem = value[0];
      if (
        firstItem &&
        typeof firstItem === "object" &&
        "record_id" in firstItem
      ) {
        result[name] = value;
        continue;
      }
    }

    result[name] = normalizeBitableValue(value);
  }
  return result;
}

/**
 * Normalize Bitable field values to plain strings/numbers.
 * Handles: text arrays [{text}], lookup wrappers {value}, formula {value},
 * user/option objects {name}, date ranges {start,end}, numbers, booleans.
 */
function normalizeBitableValue(value: unknown): unknown {
  if (value == null) return value;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((v) => {
        const n = normalizeBitableValue(v);
        return n == null ? "" : String(n);
      })
      .filter((s) => s !== "");
    return parts.join("");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Lookup / formula wrappers
    if ("value" in obj) return normalizeBitableValue(obj.value);
    // Text cell
    if ("text" in obj) return String(obj.text ?? "");
    // User / single-select / multi-select option
    if ("name" in obj) return String(obj.name ?? "");
    // Date range: {start, end} (ms timestamps)
    if ("start" in obj || "end" in obj) {
      const s = obj.start ? formatDate(obj.start) : "";
      const e = obj.end ? formatDate(obj.end) : "";
      if (s && e) return `${s} - ${e}`;
      return s || e;
    }
    // Date field: single timestamp
    if ("timestamp" in obj) return formatDate(obj.timestamp);
    return "";
  }

  return value;
}

function formatDate(v: unknown): string {
  if (typeof v !== "number" && typeof v !== "string") return "";
  const d = new Date(Number(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/**
 * Normalize a Bitable date-field value to YYYY-MM-DD.
 * Handles: ISO-ish strings (sliced), numeric / numeric-string timestamps,
 * and objects with .timestamp (via normalizeBitableValue upstream).
 */
function toIsoDate(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const n = Number(v);
    if (Number.isFinite(n)) return formatDate(n);
    return v.slice(0, 10);
  }
  if (typeof v === "number") return formatDate(v);
  return "";
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

/** Parse a YES/NO or boolean value into a boolean. */
function parseYesNo(value: unknown): boolean {
  if (value === true || value === false) return value as boolean;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "yes" || v === "y" || v === "true" || v === "1" || v === "是";
  }
  return false;
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
  console.log(
    "[InvoiceBlock] adapter build=en-aliases-v2 mode=" + FEISHU_MODE,
  );
  if (FEISHU_MODE === "real") {
    return new RealFrontendAdapter();
  }
  return new MockFrontendAdapter();
}

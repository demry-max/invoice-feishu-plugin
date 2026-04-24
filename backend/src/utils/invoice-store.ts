import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Invoice } from "../types";

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS invoices (
  invoice_no        TEXT PRIMARY KEY,
  invoice_type      TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  bill_to           TEXT NOT NULL,
  company_name      TEXT NOT NULL,
  invoice_date      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  subtotal          REAL NOT NULL,
  grand_total       REAL NOT NULL,
  source_record_ids TEXT NOT NULL,
  invoice_json      TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  status            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_date    ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_source  ON invoices(source_record_ids);
CREATE INDEX IF NOT EXISTS idx_invoices_bill_to ON invoices(bill_to);
`;

export interface InvoiceStore {
  insert(invoice: Invoice): void;
  get(invoiceNo: string): Invoice | undefined;
  listBySourceRecord(recordId: string): Invoice[];
  /**
   * Return the largest numeric suffix among invoice numbers matching
   * `${monthKey}-*`. Used to seed the in-memory counter across restarts.
   */
  getMaxSuffixForMonth(monthKey: string): number;
  close(): void;
}

export function openStore(dbPath: string): InvoiceStore {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(MIGRATIONS);

  const insertStmt = db.prepare(`
    INSERT INTO invoices (
      invoice_no, invoice_type, template_id, bill_to, company_name,
      invoice_date, currency, subtotal, grand_total, source_record_ids,
      invoice_json, created_at, status
    ) VALUES (
      @invoice_no, @invoice_type, @template_id, @bill_to, @company_name,
      @invoice_date, @currency, @subtotal, @grand_total, @source_record_ids,
      @invoice_json, @created_at, @status
    )
  `);

  const getStmt = db.prepare(
    `SELECT invoice_json FROM invoices WHERE invoice_no = ?`,
  );

  const listBySourceStmt = db.prepare(
    `SELECT invoice_json FROM invoices WHERE source_record_ids LIKE ? ORDER BY created_at DESC`,
  );

  const maxSuffixStmt = db.prepare(
    `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1`,
  );

  return {
    insert(invoice: Invoice): void {
      insertStmt.run({
        invoice_no: invoice.invoice_no,
        invoice_type: invoice.invoice_type ?? "consultant",
        template_id: invoice.template_id,
        bill_to: invoice.bill_to,
        company_name: invoice.company_name,
        invoice_date: invoice.invoice_date,
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        grand_total: invoice.grand_total,
        source_record_ids: JSON.stringify(invoice.source_record_ids ?? []),
        invoice_json: JSON.stringify(invoice),
        created_at: invoice.created_at,
        status: invoice.status,
      });
    },

    get(invoiceNo: string): Invoice | undefined {
      const row = getStmt.get(invoiceNo) as { invoice_json: string } | undefined;
      if (!row) return undefined;
      return JSON.parse(row.invoice_json) as Invoice;
    },

    listBySourceRecord(recordId: string): Invoice[] {
      const rows = listBySourceStmt.all(`%${recordId}%`) as Array<{
        invoice_json: string;
      }>;
      return rows.map((r) => JSON.parse(r.invoice_json) as Invoice);
    },

    getMaxSuffixForMonth(monthKey: string): number {
      const row = maxSuffixStmt.get(`${monthKey}-%`) as
        | { invoice_no: string }
        | undefined;
      if (!row) return 0;
      const suffix = Number(row.invoice_no.split("-")[1] ?? "0");
      return Number.isFinite(suffix) ? suffix : 0;
    },

    close(): void {
      db.close();
    },
  };
}

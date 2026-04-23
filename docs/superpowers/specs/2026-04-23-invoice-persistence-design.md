# Invoice Persistence Design

- **Date:** 2026-04-23
- **Topic:** Persist generated invoices across container rebuilds
- **Status:** Approved (awaiting implementation plan)
- **Author:** Demry Cheng

## Context

The `invoice-api` backend currently stores generated invoices in two volatile places:

1. `invoiceStore = new Map<string, Invoice>()` — lost on process exit.
2. `OUTPUT_DIR = /app/backend/output` inside the container — lost on every `docker build` / `docker compose up -d --force-recreate` because the directory is not mounted.

Each deploy therefore wipes every previously generated invoice. The Feishu plugin writes the HTML and PDF URLs back to the Bitable row, so any URL that was already propagated to a customer (or stored in the work-order record) returns 404 after the next deploy. This is the single highest-risk correctness bug in the plugin today.

## Goals

- Invoices survive container restart, `docker compose up -d --force-recreate`, and `docker build` + recreate.
- Existing HTTP endpoints (`GET /api/invoices/:no/html`, `GET /api/invoices/:no/pdf`, metadata fetch) keep working with no client-side changes.
- New infrastructure is limited to one host directory and one Docker volume mount.
- Leave a usable query surface for the follow-up duplicate-detection feature (#9) without implementing it now.

## Non-goals

- Retention / archival / pruning policy.
- Multi-tenant isolation.
- Cloud object storage (S3 / R2 / Feishu cloud).
- Migration of historical invoices — there are none to migrate; every previous invoice has already been lost.
- A schema-migration framework — `CREATE TABLE IF NOT EXISTS` is enough until the schema evolves.

## Chosen Approach: Docker volume + SQLite

A single host directory (`/opt/invoice-api/data`) is mounted into the container at a stable data path (`/app/backend/data`). The container's current `OUTPUT_DIR` is hard-coded as `path.join(__dirname, "../../output")` which resolves to `/app/backend/dist/backend/output` at runtime — that couples the persistent directory to the compiled output layout. As part of this change we switch to an env-driven `DATA_DIR` (default `/app/backend/data`) and mount the volume there. Inside that directory we keep:

- `invoices.db` — SQLite file with one row per invoice.
- `{invoice_no}.html` and `{invoice_no}.pdf` — unchanged from the current layout.

`better-sqlite3` is the driver: synchronous API, no connection pool, single-file DB, and pre-built Linux x64 binaries so the Dockerfile does not need to change.

### Why not a JSONL log (the previously proposed option A)

A JSONL log would also solve persistence, but it would not give us a queryable `source_record_ids` index, which is a prerequisite for feature #9 (duplicate-invoice detection). Spending roughly half a day now to use SQLite avoids a second rewrite when #9 lands.

### Why not object storage (option C)

- Adds credentials, an SDK, and signed-URL handling.
- Changes the served domain, re-introducing the Feishu domain whitelist problem we already worked around with blob-based downloads.
- Over-invests given current scale (tens of invoices per month).

## Architecture

```
/opt/invoice-api/data/                 (host, mounted → /app/backend/data)
├── invoices.db                        # SQLite single file
├── 202604-00001.html
├── 202604-00001.pdf
├── 202604-00002.html
└── 202604-00002.pdf
```

Single process, single DB file, no external services.

## Schema

```sql
CREATE TABLE IF NOT EXISTS invoices (
  invoice_no        TEXT PRIMARY KEY,
  invoice_type      TEXT NOT NULL,      -- 'consultant' | 'final_payment'
  template_id       TEXT NOT NULL,
  bill_to           TEXT NOT NULL,
  company_name      TEXT NOT NULL,
  invoice_date      TEXT NOT NULL,      -- YYYY-MM-DD
  currency          TEXT NOT NULL,
  subtotal          REAL NOT NULL,
  grand_total       REAL NOT NULL,
  source_record_ids TEXT NOT NULL,      -- JSON array, e.g. ["recXXX","recYYY"]
  invoice_json      TEXT NOT NULL,      -- serialized Invoice for round-trip
  created_at        TEXT NOT NULL,      -- ISO 8601
  status            TEXT NOT NULL       -- 'generated' today; reserved for later states
);

CREATE INDEX IF NOT EXISTS idx_invoices_date    ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_source  ON invoices(source_record_ids);
CREATE INDEX IF NOT EXISTS idx_invoices_bill_to ON invoices(bill_to);
```

`invoice_json` stores the full `Invoice` object so we don't need a column per new field; hot query paths project the columns we care about. Schema changes that add new columns can be made additive (`ALTER TABLE ADD COLUMN`) without touching the JSON blob.

## Behavior

| Operation | Implementation |
|---|---|
| Startup | `new Database(DB_PATH)` followed by `db.exec(migrations)`. No eager load of the full table into memory. |
| Generate | Write HTML, write PDF, then `INSERT INTO invoices (...)` inside a transaction. |
| `getInvoice(no)` | `SELECT invoice_json FROM invoices WHERE invoice_no = ?` → `JSON.parse`. |
| `getInvoiceHtml(no)` / `getInvoicePdf(no)` | Disk read, unchanged. |
| `listInvoicesForSourceRecords(recordIds)` | `SELECT invoice_json FROM invoices WHERE source_record_ids LIKE '%' \|\| ? \|\| '%'` for each id, UNION — unused by current endpoints, exposed for feature #9. |

The in-memory `Map` is removed entirely. Every lookup hits SQLite. At current volume (tens of invoices per month) this is well inside "read the whole table in under 1ms".

## Error Handling

- **DB open fails** — fatal at startup; server exits with a non-zero code. Docker compose's `restart: unless-stopped` will attempt to restart; if the volume is misconfigured the container will crash-loop, which is the correct visible failure mode.
- **INSERT fails** — transaction rolls back, HTTP 500 returned to the frontend. HTML and PDF files may still be on disk as orphans; that is acceptable because the invoice is re-generable. A future cleanup task (out of scope here) can reconcile orphans.
- **Concurrent writes** — `better-sqlite3` serializes writes internally, so no additional locking is required. This also eliminates the "two users generate the same invoice number" race that would otherwise show up when we wire duplicate detection.
- **DB corruption** — SQLite is robust under power loss thanks to journaling, but a catastrophically corrupted file will be detected on open and cause the server to exit. Recovery is manual: restore from backup (see Operations).

## Infrastructure Changes

1. `docker-compose.yml` — add a volume mount and env:
   ```yaml
   services:
     invoice-api:
       environment:
         DATA_DIR: /app/backend/data
       volumes:
         - /opt/invoice-api/data:/app/backend/data
   ```
2. VPS bootstrap (one-time):
   ```bash
   mkdir -p /opt/invoice-api/data
   ```
   The container runs as root (the `mcr.microsoft.com/playwright` base image default), so no `chown` is needed.
3. `backend/Dockerfile` — no change; `better-sqlite3` ships prebuilt `linux-x64` and `linux-arm64` binaries.

## Code Changes

- **New** `backend/src/utils/invoice-store.ts` (~100 lines):
  - `openStore(dbPath: string)` — opens DB, runs migrations, returns a typed store.
  - `insert(invoice: Invoice): void`
  - `get(invoiceNo: string): Invoice | undefined`
  - `listBySourceRecord(recordId: string): Invoice[]` — for feature #9.
- **Modified** `backend/src/services/invoice-service.ts`:
  - Remove `invoiceStore = new Map<>`.
  - `getInvoice` and `generateInvoice` call into the new store.
  - Replace the compiled-path `OUTPUT_DIR` with an env-driven `DATA_DIR` (`process.env.DATA_DIR || path.join(__dirname, "../../data")`); the store defaults its DB path to `${DATA_DIR}/invoices.db`, HTML/PDF live in the same directory.
  - Ensure `DATA_DIR` is created at startup (same `mkdirSync` pattern as today).
- **Modified** `backend/package.json` — add `better-sqlite3` + `@types/better-sqlite3`.
- **New** `backend/__tests__/invoice-store.test.ts` (see Testing).

No frontend changes.

## Testing

**Unit (`backend/__tests__/invoice-store.test.ts`):**

- `insert` followed by `get` returns an `Invoice` equal in every field to the one written.
- `listBySourceRecord` finds an invoice whose `source_record_ids` contains the queried id, and returns an empty array when nothing matches.
- Reopening the DB (fresh `openStore` call) preserves all previously inserted rows — this is the regression test that would catch a silent-on-restart bug.

**Integration (manual, on staging or VPS):**

1. Generate two invoices through the plugin.
2. `docker compose up -d --force-recreate`.
3. `curl https://invoice-api.gdsgroup.tech/api/invoices/:no/html` for each — expect HTTP 200 and correct body.
4. `docker build -t invoice-api:latest . && docker compose up -d --force-recreate` — repeat step 3.

**Regression (Playwright PDF generation):** unchanged; existing generate-path tests cover this implicitly by running the PDF step.

## Operations

- **Backup:** `cp /opt/invoice-api/data/invoices.db /opt/invoice-api/backups/invoices-$(date +%F).db` via cron, weekly. The HTML and PDF files live in the same directory and are already covered by a host-level backup.
- **Monitoring:** none added here. If the DB becomes the bottleneck or corruption becomes a concern, add a `SELECT 1` check to the `/health` endpoint — deferred until it matters.
- **Disk usage:** each invoice = HTML (~20 KB) + PDF (~50 KB) + 1 row (~2 KB). 10 000 invoices ≈ 720 MB. Not a concern at projected volume.

## Open Questions

None. All earlier ambiguities were resolved during brainstorming:

- Chose SQLite over JSONL (decided).
- Chose local disk over object storage (decided).
- Deferred retention / archival to a later change (decided).
- Did not introduce a migration framework (decided).

## Appendix: Rejected Alternatives

- **A. JSONL log** — simpler, but no indexed query for feature #9 and eventual re-write.
- **C. S3 / R2 / MinIO** — durable but over-engineered for current scale and re-introduces the Feishu domain whitelist problem.

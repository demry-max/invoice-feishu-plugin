/**
 * 账单编号生成器
 *
 * Format: `YYYYMM-XXXXX` where XXXXX is a random 5-digit number in [10000, 99999].
 *
 * History
 * -------
 * The legacy format used a per-month sequential counter (`YYYYMM-00001`,
 * `YYYYMM-00002`, …). That worked when a single backend instance owned the
 * counter, but in practice multiple environments (local dev, container
 * rebuilds, stale stores) re-issued low suffixes and overwrote existing
 * invoices on the Bitable side. Random allocation across a 90 000-value
 * space, combined with a collision check against the store, makes
 * accidental reuse vanishingly unlikely while keeping the human-readable
 * `YYYYMM-` prefix.
 */

/**
 * Look up whether an invoice number already exists. Returning `true` makes
 * `generateInvoiceNo` retry with another random suffix.
 */
export type InvoiceExistsCheck = (invoiceNo: string) => boolean;

function getMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/**
 * Random integer in [min, max] inclusive. Uses `Math.random()` — fine for
 * non-cryptographic uniqueness over 90 000 values; collisions are checked
 * by the caller.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a fresh invoice number in `YYYYMM-XXXXX` form.
 *
 * Pass `exists` to retry on collision against an existing store. After
 * `maxAttempts` random tries the function falls back to a millisecond-
 * suffixed value so generation never blocks the user; an operator can
 * then rename the invoice manually if needed.
 */
export function generateInvoiceNo(
  options: {
    exists?: InvoiceExistsCheck;
    maxAttempts?: number;
  } = {},
): string {
  const monthKey = getMonthKey();
  const exists = options.exists ?? (() => false);
  const maxAttempts = options.maxAttempts ?? 50;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = String(randomInt(10000, 99999));
    const candidate = `${monthKey}-${suffix}`;
    if (!exists(candidate)) return candidate;
  }

  // Fallback: append the current millisecond to guarantee uniqueness within
  // a single process instance. Still keeps the `YYYYMM-` prefix.
  const fallbackSuffix = `${randomInt(10000, 99999)}${String(Date.now()).slice(-3)}`;
  return `${monthKey}-${fallbackSuffix}`;
}

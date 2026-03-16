export function formatAmount(n: number, currency: string = '¥'): string {
  return `${currency}${n.toFixed(2)}`;
}

export function calcLineTotal(price: number, qty: number, discountPercent: number): number {
  const q = Math.max(qty, 1);
  const d = discountPercent || 0;
  return Math.round(price * q * (1 - d / 100) * 100) / 100;
}

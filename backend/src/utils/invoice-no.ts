/**
 * 账单编号生成器
 * 格式: YYYYMM-00001
 * 同一月份内递增
 */

// 内存计数器 (MVP阶段) - 后续可替换为数据库序列或飞书表查询
const counters = new Map<string, number>();

function getMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function generateInvoiceNo(): string {
  const key = getMonthKey();
  const current = counters.get(key) || 0;
  const next = current + 1;
  counters.set(key, next);
  return `${key}-${String(next).padStart(5, '0')}`;
}

/** 重置计数器（测试用） */
export function resetCounter(monthKey?: string): void {
  if (monthKey) {
    counters.delete(monthKey);
  } else {
    counters.clear();
  }
}

/** 设置计数器起始值（用于从飞书表读取最大值后初始化） */
export function setCounter(monthKey: string, value: number): void {
  counters.set(monthKey, value);
}

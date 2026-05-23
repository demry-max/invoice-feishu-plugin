# Invoice Generator 使用教程

> 飞书多维表格账单生成插件 — 内部财务/运营操作手册
> 最近更新：2026-05-18

---

## 目录

1. [前置准备](#1-前置准备)
2. [日常生成账单（黄金路径）](#2-日常生成账单黄金路径)
3. [顾问账单详解](#3-顾问账单详解)
4. [尾款账单详解](#4-尾款账单详解)
5. [币种换算逻辑](#5-币种换算逻辑)
6. [重复/补开账单](#6-重复补开账单)
7. [发送给客户](#7-发送给客户)
8. [常见问题排查](#8-常见问题排查)
9. [字段对照表](#9-字段对照表)

---

## 1. 前置准备

打开多维表格 → 选择「业务工单 / Business Ticket」表 → 在右侧选择 **Invoice Generator** 插件。

### 必备表结构

| 表名 | 必须存在的列 |
|---|---|
| 业务工单 \| Business Ticket | `Company Name`, `Customer Name`, `Associated Service ID`, `Bill Currency`, `Bill Number`, `Billing Date`, `HTML link`, `PDF link`, `Add:VAT(x%)`, `Less:EWT(2%)`, `Final Billing Number`, `Final Billing Date`, `Final HTML link`, `Final PDF link`, `Final Balance`, `Display Currency`, `Amount Refunded`, `Total Deduction Amount`, `Final bill currency` |
| 任务明细表 \| Task Detail List | `Service Name`, `Service Term`, `Price`, `Qty`, `Discount%`, `Total`, `Taxation Identification`, `Actual Amount Incurred`, `Received Amount`, `Note` |
| 汇率表 \| Exchange Rate Table | `Original currency`, `Target currency`, `Effective Date`, `Expiry Date`, `Exchange rate` |

> 字段名不区分大小写，插件支持中文/英文别名。

---

## 2. 日常生成账单（黄金路径）

**90% 的场景，5 步搞定：**

1. **选行** — 在业务工单表点击一行 WO
2. **打开插件** — 插件自动加载该 WO 的客户信息和关联的服务明细
3. **选类型** — 顶部点 `顾问账单` 或 `尾款账单`
4. **检查总计** — 右下角实时显示 Grand Total
5. **生成** — 点 `生成正式账单`，等待 PDF 生成，下载/复制链接

✅ 完成后自动写回主表（Bill Number / Billing Date / VAT / EWT 等字段）

---

## 3. 顾问账单详解

### 适用场景
首次开账单给客户，按合同价 + 增值税计算。

### 关键控件

| 控件 | 选项 | 说明 |
|---|---|---|
| **品牌模板** | 菲龙咨询 / Feilong Consulting `or` 星耀财税 / Star Shine Taxation | 决定 PDF 抬头、Logo、银行账户、是否计算 EWT |
| **含税模式** | 不含税 `or` 含税 | 不含税 → 不计 VAT/EWT；含税 → 按所选比例计算 |
| **税率比例 / VAT Rate** | 1% / 3% / 6% / 12% | 仅在「含税」模式下出现 |
| **预扣税比例 / EWT Rate** | 2% / 10% / 15% | **仅菲律宾 Starlight 出现**；菲龙咨询不计 EWT |
| **银行账户** | 下拉列表 | 决定 PDF 底部银行信息 |

### 计算公式

```
税前小计 = Σ(明细 line_total，仅 Taxation Identification = YES 的行)
总小计   = Σ(明细 line_total)（全部行）

含税模式：
  VAT 金额 = 税前小计 × VAT 税率
  EWT 金额 = 税前小计 × EWT 税率（仅 Starlight）
  Grand Total = 总小计 + VAT − EWT

不含税模式：
  Grand Total = 总小计
```

### 备注 (Notes) 自动文案

- **不含税**："上述报价不含税；如需开票，可加收 6% 费用开具增值税普通发票或专用发票。"
- **含税**："上述报价含税，可开具增值税专用发票。"

### 写回字段（生成后自动填入业务工单）

- `Bill Number` ← 新生成的账单号（首次）
- `Billing Date` ← 账单日期（当天）
- `HTML link` / `PDF link` ← 文档链接
- `Add:VAT(x%)` ← VAT 金额
- `Less:EWT(2%)` ← EWT 金额（菲龙为 0）

---

## 4. 尾款账单详解

### 适用场景
客户已支付部分款项，菲律宾财务在「任务明细表」填写 Actual Amount Incurred 和 Received Amount 后，由插件结算最终尾款。

### 关键控件

| 控件 | 选项 | 说明 |
|---|---|---|
| **展示币种 / Display Currency** | 原始 / CNY / USD / PHP | 决定 PDF 上金额显示的币种 |
| **品牌模板** | 同顾问账单 | |
| **银行账户** | 下拉 | |

### 明细表列

| 列 | 来源 | 说明 |
|---|---|---|
| Bill Number | 业务工单 | 之前生成的顾问账单号 |
| Date | 业务工单.Billing Date | 顾问账单的开账日 |
| Product/Service | 任务明细表.Service Name | 服务名 |
| Amount Billed | 任务明细表.Total | 已开金额 |
| Actual Amount Incurred | 任务明细表 | 实际发生 |
| Amount Paid | 任务明细表.Received Amount | 已收款 |
| Balance | 计算 | = Actual − Paid |
| Note | 任务明细表.Note | 备注 |

### 计算公式

```
Total Balance = Σ Balance = Σ (Actual − Paid)
Final Balance = Total Balance + Amount Refunded
              （若退款 > 0，加上退款金额）
```

> ⚠️ 不计 VAT/EWT；不展示 Deductible Amount

### 写回字段

- `Final Billing Number`
- `Final Billing Date`
- `Final HTML link` / `Final PDF link`
- `Final Balance`
- `Display Currency`（用户所选的展示币种）

---

## 5. 币种换算逻辑

### 何时换算？

- 选了「原始」→ 完全不换算，按各字段原始币种展示
- 选了 CNY/USD/PHP 且**等于**业务工单的源币种 → 不换算
- 选了 CNY/USD/PHP 但**不等于**源币种 → 按汇率表换算

### 两套汇率分别处理（关键！）

| 字段 | 走哪个汇率 |
|---|---|
| Amount Billed / Paid / Refunded / Deductible | **Bill Currency → 展示币种** |
| Actual Amount Incurred | **Final bill currency → 展示币种** |

> 因为 Actual Amount Incurred 通常用付款货币记账（比如菲律宾报销用 PHP），而其他金额走合同币种（比如 CNY）。

### 汇率查找规则

在「汇率表」中查找满足：
- `Original currency` = 源币种
- `Target currency` = 展示币种
- 账单日期 ∈ [`Effective Date`, `Expiry Date`]

找不到匹配？UI 会出黄色警告条，自动按 1:1 处理。

---

## 6. 重复/补开账单

### 同一 WO 重新生成 → 编号不变

如果对同一业务工单**重新生成同类型账单**（顾问/尾款），插件会**自动复用原编号**，不会产生新编号。

- 第一次生成 `202605-12796`
- 改了几行明细后再点生成 → 仍然是 `202605-12796`（HTML + PDF 内容更新覆盖）

### 不同类型 → 独立编号

同一 WO 的顾问账单和尾款账单各有独立编号：
- 顾问：`202605-12796`
- 尾款：`202605-12807`

### 重复检测提示

如果选中的 WO 已经有账单了，插件**顶部黄条**会列出：
```
⚠️ 此工单已生成过账单
202605-12796 · 顾问 · 2026-05-15 · ¥88,400
```
点「忽略并继续生成新账单」可强制覆盖。

---

## 7. 发送给客户

### 当前方式（手动）
生成后界面给三个按钮：
- `📄 查看 HTML 账单` — 浏览器新 tab 打开
- `📥 下载 PDF 账单` — 直接下载 PDF（绕过飞书域名限制）
- `复制链接` — 拷贝 URL 到剪贴板

把 PDF 当作附件附到邮件里发给客户即可。

### 未来计划（v3）
- 一键填充收件人（从工单主表的客户邮箱字段读取）
- 内置邮件模板（中/英）
- 发送状态写回主表（`Sent At` / `Sent To`）

---

## 8. 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 加载选中记录后**全部字段为空** | 字段名不匹配 | 检查表列名是否使用了支持的别名；按 F12 打开 Console，找 `工单主表 fields:` 行核对 |
| 明细表 `Service Period` 列为空 | 关联表的 `Service Term` 列缺失或空 | 在任务明细表填写 `Service Term` |
| 币种换算显示 `汇率表中无 XXX→YYY 行` | 当天无汇率 | 在汇率表添加包含当前账单日期的有效汇率行 |
| 写回 `Billing Date` 为空 | 旧版本插件用字符串写回，被飞书拒绝 | 在新版本 (≥ 5/18) 已修，重新生成即可 |
| 生成成功但 `下载 PDF` 显示 `invoice-api.gdsgroup.tech is blocked` | 飞书域名白名单缺失 | App 管理员在「网络配置 → 服务器域名白名单」添加 `https://invoice-api.gdsgroup.tech` |
| 「未在汇率表中找到匹配行」误报 | 日期字段读成毫秒戳 → 字符串比较出错 | 已修复（5/18） |
| 重新生成产生了新编号 | 主表 `Bill Number` 字段被清空过 | 插件靠主表已有编号判断"是否已生成"；清空后会重新分配 |
| 出 PDF 报 Playwright 错误 | 镜像 Chromium 版本不匹配 | 后端容器需用 `mcr.microsoft.com/playwright:v1.59.1-jammy` 以上 |

### 调试模式
插件加载完成后浏览器 Console 会打印：
```
[InvoiceBlock] adapter build=en-aliases-v2 mode=real
[RealFrontend] 工单主表 fields: [...]
[RealFrontend] 任务明细表 fields: [...]
[RealFrontend] 汇率表 rows: 6 ["CNY→PHP=8.3 [2026-04-01..2026-12-31]", ...]
```

把这些贴给开发者，问题定位最快。

---

## 9. 字段对照表

### 业务工单 \| Business Ticket（读 + 写回）

| 插件用法 | 飞书字段名 |
|---|---|
| BILL TO 第一行 | `Company Name` |
| BILL TO 第二行 | `Customer Name` |
| 关联服务 | `Associated Service ID` |
| 源币种 (Amount Billed/Paid/Refunded/Deductible) | `Bill Currency` |
| 源币种 (Actual Amount Incurred) | `Final bill currency` |
| 退款金额 | `Amount Refunded` |
| 扣款金额 | `Total Deduction Amount` |
| ←写回 顾问账单号 | `Bill Number` |
| ←写回 顾问账单日 | `Billing Date` |
| ←写回 HTML 链接 | `HTML link` |
| ←写回 PDF 链接 | `PDF link` |
| ←写回 VAT 金额 | `Add:VAT(x%)` |
| ←写回 EWT 金额 | `Less:EWT(2%)` |
| ←写回 尾款账单号 | `Final Billing Number` |
| ←写回 尾款账单日 | `Final Billing Date` |
| ←写回 尾款 HTML 链接 | `Final HTML link` |
| ←写回 尾款 PDF 链接 | `Final PDF link` |
| ←写回 尾款合计 | `Final Balance` |
| ←写回 展示币种 | `Display Currency` |

### 任务明细表 \| Task Detail List

| 插件用法 | 飞书字段名 |
|---|---|
| 服务名 | `Service Name` |
| 服务期限 | `Service Term` |
| 单价 | `Price` |
| 数量 | `Qty` |
| 折扣 | `Discount%` |
| 行合计 | `Total` |
| 是否参与税计算 | `Taxation Identification` (值 `YES`/`NO`) |
| 实际发生 | `Actual Amount Incurred` |
| 已收 | `Received Amount` |
| 备注 | `Note` |

### 汇率表 \| Exchange Rate Table

| 插件用法 | 飞书字段名 |
|---|---|
| 源币种 | `Original currency` |
| 目标币种 | `Target currency` |
| 生效日 | `Effective Date` |
| 失效日 | `Expiry Date` |
| 汇率 | `Exchange rate` |

---

## 反馈

发现问题 / 想要新功能，直接告诉开发同事，附上：
- 浏览器 Console 截图
- 多维表格中操作的工单号（如 WO-00077）
- 期望结果 vs 实际结果

---

**Built with ❤️ by Demry · Last updated 2026-05-18**

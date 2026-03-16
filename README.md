# Invoice Generator for Feishu Base (飞书多维表格账单生成插件)

飞书多维表格插件，用于根据多维表格中的服务项目记录一键生成账单预览、写回账单数据，并输出可打印的 HTML/PDF 账单。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React + TypeScript + Vite |
| 后端 | Node.js + Express + TypeScript |
| PDF 生成 | Playwright (HTML → PDF) |
| 模板 | 服务端 HTML 模板 + CSS (A4优化) |
| 飞书集成 | Adapter 模式 (Mock / Real) |

## 目录结构

```
invoice-feishu-plugin/
├── frontend/                  # 前端 React 应用
│   ├── src/
│   │   ├── adapters/          # 飞书前端适配器
│   │   ├── components/        # UI 组件
│   │   ├── hooks/             # React Hooks
│   │   ├── services/          # API 调用
│   │   ├── types/             # 类型定义
│   │   ├── utils/             # 工具函数
│   │   ├── App.tsx            # 主页面
│   │   ├── App.css            # 样式
│   │   └── main.tsx           # 入口
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/                   # 后端 Express 服务
│   ├── src/
│   │   ├── adapters/          # 飞书后端适配器
│   │   ├── controllers/       # 路由处理
│   │   ├── routes/            # API 路由
│   │   ├── services/          # 业务逻辑
│   │   ├── templates/         # HTML 模板 + CSS
│   │   ├── types/             # 类型定义
│   │   ├── utils/             # 工具函数
│   │   ├── app.ts             # Express 应用
│   │   └── server.ts          # 服务入口
│   ├── package.json
│   └── tsconfig.json
├── shared/                    # 前后端共享类型
│   └── types/
│       └── index.ts
├── .env.example               # 环境变量示例
└── README.md
```

## 本地启动

### 前置要求

- Node.js >= 18
- npm 或 yarn

### 1. 安装依赖

```bash
# 后端
cd backend
npm install
npx playwright install chromium

# 前端
cd ../frontend
npm install
```

### 2. 配置环境变量

```bash
# 后端
cp ../.env.example backend/.env
# 编辑 backend/.env 按需修改

# 前端
cp ../.env.example frontend/.env
# 编辑 frontend/.env 按需修改
```

### 3. 启动后端

```bash
cd backend
npm run dev
```

后端将运行在 http://localhost:3000

### 4. 启动前端

```bash
cd frontend
npm run dev
```

前端将运行在 http://localhost:5173

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | `3000` |
| `BASE_URL` | 后端基础URL | `http://localhost:3000` |
| `FEISHU_MODE` | 飞书模式 (mock/real) | `mock` |
| `FEISHU_APP_ID` | 飞书应用ID | - |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | - |
| `VITE_API_BASE_URL` | 前端API地址 | `http://localhost:3000` |
| `VITE_FEISHU_MODE` | 前端飞书模式 | `mock` |

## Mock 数据测试

项目默认以 Mock 模式运行，无需飞书环境即可完整测试。

1. 启动前后端
2. 打开 http://localhost:5173
3. 点击「加载选中记录」→ 加载 3 条示例数据
4. 点击「生成预览」→ 查看金额计算
5. 点击「生成正式账单」→ 生成 HTML + PDF
6. 点击链接查看/下载

Mock 数据位于 `backend/src/adapters/feishu-adapter.ts` 中的 `MOCK_SOURCE_ITEMS`。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/invoices/preview` | 预览账单（不落库） |
| POST | `/api/invoices/generate` | 生成正式账单 |
| GET | `/api/invoices/:invoiceNo/html` | 查看 HTML 账单 |
| GET | `/api/invoices/:invoiceNo/pdf` | 下载 PDF 账单 |
| GET | `/api/mock/source-items` | 获取 Mock 数据 |

## 替换为真实飞书 Base Extension SDK

1. 安装飞书 SDK：`npm install @lark-base-open/js-sdk`
2. 实现 `backend/src/adapters/feishu-adapter.ts` 中的 `RealFeishuAdapter`
3. 实现 `frontend/src/adapters/feishu-adapter.ts` 中的 `RealFrontendAdapter`
4. 将环境变量 `FEISHU_MODE` / `VITE_FEISHU_MODE` 改为 `real`
5. 配置飞书应用凭证

核心改动点：
- 读取选中记录：`bitable.base.getSelection()` + `table.getRecordById()`
- 写入记录：`table.addRecord({ fields: {...} })`
- 更新记录：`table.setRecord(recordId, { fields: {...} })`

## 部署

### 后端部署

```bash
cd backend
npm run build
node dist/server.js
```

确保部署环境已安装 Playwright Chromium：
```bash
npx playwright install chromium --with-deps
```

### 前端部署

```bash
cd frontend
npm run build
```

将 `dist/` 目录部署到静态文件服务（Nginx / CDN / 飞书插件托管）。

## 计算规则

- 单行合计：`line_total = price × qty × (1 - discount_percent / 100)`
- Total：所有 line_total 之和
- VAT：`Total × 6%`
- Grand Total：`Total + VAT`
- 所有金额保留 2 位小数
- 折扣为空按 0 处理，数量最小为 1

## 账单编号规则

格式：`YYYYMM-00001`（如 202603-00001）

同一月份内自动递增。MVP 使用内存计数器，后续可替换为数据库序列或飞书表内最大值查询。

## Future Enhancements

- [ ] 可配置税率（支持不同税率场景）
- [ ] 不同账单模板（多套 HTML 模板切换）
- [ ] 自动提醒付款（到期提醒）
- [ ] 飞书消息通知（账单生成后推送消息）
- [ ] 审批流（接入飞书审批）
- [ ] 邮件发送（自动将账单发送给客户）
- [ ] 上传 PDF 到对象存储（OSS / S3）
- [ ] 多公司主体切换（不同公司信息模板）
- [ ] 多币种支持（自动汇率换算）
- [ ] 自动生成二维码付款
- [ ] 账单状态管理（待支付/已支付/逾期）
- [ ] 批量生成账单
- [ ] 账单模板可视化编辑器
- [ ] 数据导出 Excel

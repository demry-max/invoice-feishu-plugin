import { Router } from "express";
import type { Request, Response } from "express";
import {
  handlePreview,
  handleGenerate,
  handleGetHtml,
  handleGetPdf,
  handleGetMockItems,
} from "../controllers/invoice-controller";
import { getAllBankAccounts } from "../utils/bank-accounts";
import type { ApiResponse, BankAccount } from "../types";

const router = Router();

router.post("/invoices/preview", handlePreview);
router.post("/invoices/generate", handleGenerate);
router.get("/invoices/:invoiceNo/html", handleGetHtml);
router.get("/invoices/:invoiceNo/pdf", handleGetPdf);
router.get("/mock/source-items", handleGetMockItems);

/** GET /api/bank-accounts - 获取可用银行账户列表 */
router.get("/bank-accounts", (_req: Request, res: Response) => {
  const accounts = getAllBankAccounts();
  res.json({ success: true, data: accounts } as ApiResponse<BankAccount[]>);
});

export default router;

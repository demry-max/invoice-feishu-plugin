import { Router } from 'express';
import {
  handlePreview,
  handleGenerate,
  handleGetHtml,
  handleGetPdf,
  handleGetMockItems,
} from '../controllers/invoice-controller';

const router = Router();

router.post('/invoices/preview', handlePreview);
router.post('/invoices/generate', handleGenerate);
router.get('/invoices/:invoiceNo/html', handleGetHtml);
router.get('/invoices/:invoiceNo/pdf', handleGetPdf);
router.get('/mock/source-items', handleGetMockItems);

export default router;

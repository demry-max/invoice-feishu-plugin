import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { closeBrowser } from './services/pdf-service';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n  Invoice Generator Backend`);
  console.log(`  ========================`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Mode: ${process.env.FEISHU_MODE === 'real' ? 'REAL' : 'MOCK'}`);
  console.log(`  API docs:`);
  console.log(`    POST /api/invoices/preview`);
  console.log(`    POST /api/invoices/generate`);
  console.log(`    GET  /api/invoices/:no/html`);
  console.log(`    GET  /api/invoices/:no/pdf`);
  console.log(`    GET  /api/mock/source-items`);
  console.log(`    GET  /health\n`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
});

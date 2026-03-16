import express from 'express';
import cors from 'cors';
import invoiceRoutes from './routes/invoice-routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 路由
app.use('/api', invoiceRoutes);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;

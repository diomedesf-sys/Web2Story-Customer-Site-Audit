import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import auditRoutes from './routes/audit.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve generated PDF reports statically
app.use('/reports', express.static(path.join(process.cwd(), 'reports')));

app.use('/api/audit', auditRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Website Audit Engine API',
    version: '1.0.0',
    endpoints: {
      'POST /api/audit/start': 'Run a standard audit (Lighthouse + Crawl)',
      'POST /api/audit/deep': 'Run a full deep audit with GA4 + GSC',
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Audit Engine running on http://localhost:${PORT}`);
});

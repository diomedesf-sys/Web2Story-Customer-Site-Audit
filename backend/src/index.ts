import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import captureRoutes from './routes/capture.routes';
import analyzeRoutes from './routes/analyze.routes';
import workspaceRoutes from './routes/workspace.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve generated PDF reports statically
app.use('/reports', express.static(path.join(process.cwd(), 'reports')));

// Dashboard routes
app.use('/api/capture', captureRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/workspaces', workspaceRoutes);

// Serve the dashboard UI — must come after API routes so /api/* is never shadowed
app.use(express.static(path.join(process.cwd(), 'public')));

app.listen(PORT, () => {
  console.log(`🚀 Audit Engine running on http://localhost:${PORT}`);
});

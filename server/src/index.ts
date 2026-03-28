import express from 'express';
import path from 'path';
import pinoHttp from 'pino-http';
import { securityMiddleware } from './middleware/SecurityMiddleware';
import { chatRouter } from './routes/chat';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT ?? 8080;

// Structured request logging
app.use(pinoHttp({ logger }));

// Security middleware (CORS, helmet, rate limiting)
securityMiddleware(app);

app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/chat', chatRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend static files
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
app.use(express.static(CLIENT_DIST));

// Catch-all: return index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started');
});

export { app };

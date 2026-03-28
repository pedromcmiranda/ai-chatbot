import express from 'express';
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

// Routes
app.use('/api/chat', chatRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started');
});

export { app };

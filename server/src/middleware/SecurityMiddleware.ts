import type { Application } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { logger } from '../utils/logger';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow server-to-server / health-probe requests (no origin header)
    if (!origin) {
      return callback(null, true);
    }
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    logger.warn({ origin }, 'CORS rejected request from unlisted origin');
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // preflight cache: 24 h
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/health',
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // tighter limit for AI endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat rate limit exceeded. Please slow down.' },
  keyGenerator: (req) => {
    // Rate-limit per authenticated user when auth header is present
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7, 40);
    return req.ip ?? 'unknown';
  },
});

export function securityMiddleware(app: Application): void {
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", ...ALLOWED_ORIGINS],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false, // adjust if needed for GCS signed URLs
    }),
  );

  app.use(cors(corsOptions));
  app.use(apiLimiter);
  app.use('/api/chat', chatLimiter);
}

import type { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Initialize Firebase Admin SDK once; credentials come from the environment
// (Application Default Credentials on Cloud Run, or GOOGLE_APPLICATION_CREDENTIALS locally)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export interface AuthenticatedRequest extends Request {
  uid: string;
  email?: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as AuthenticatedRequest).uid = decoded.uid;
    (req as AuthenticatedRequest).email = decoded.email;
    next();
  } catch (err) {
    logger.warn({ err }, 'Firebase token verification failed');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

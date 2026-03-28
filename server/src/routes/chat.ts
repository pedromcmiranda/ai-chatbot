import { Router, type Request, type Response } from 'express';
import { ChatAgent } from '../agents/ChatAgent';
import { ChatRequestSchema, UploadRequestSchema } from '../validation/schemas';
import { createSignedUploadUrl } from '../services/storage/StorageService';
// import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware'; // TODO: re-enable for production
import { logger } from '../utils/logger';

export const chatRouter = Router();

// Singleton agent — skills are loaded once at startup
const agent = new ChatAgent();

chatRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { message, history, useGrounding, skillIds } = parsed.data;

  try {
    const { text, skillResults } = await agent.chat(message, history, {
      useGrounding,
      skillIds,
    });

    res.json({ text, skillResults });
  } catch (err) {
    logger.error({ err }, 'Chat request failed');
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

chatRouter.get('/skills', (_req: Request, res: Response) => {
  res.json({ skills: agent.availableSkills });
});

chatRouter.post('/upload-url', async (req: Request, res: Response): Promise<void> => {
  const parsed = UploadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { filename, contentType, sizeBytes } = parsed.data;

  try {
    const result = await createSignedUploadUrl('anonymous', filename, contentType);
    logger.info({ filename, sizeBytes }, 'Signed upload URL issued');
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to create upload URL');
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

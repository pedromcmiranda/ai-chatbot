import { z } from 'zod';

// Prevent excessively long prompts and common injection patterns
const safeString = (maxLen: number) =>
  z
    .string()
    .min(1)
    .max(maxLen)
    .refine(
      (val) => !/^\s*<(script|iframe|object|embed)/i.test(val),
      { message: 'Potentially unsafe HTML content detected' },
    );

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: safeString(8000),
});

export const ChatRequestSchema = z.object({
  message: safeString(4000),
  history: z.array(ChatMessageSchema).max(50).optional().default([]),
  useGrounding: z.boolean().optional().default(false),
  skillIds: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)).max(5).optional().default([]),
});

export const UploadRequestSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\w.\-() ]+$/, 'Filename contains invalid characters'),
  contentType: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/, 'Invalid MIME type'),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // 100 MB max
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

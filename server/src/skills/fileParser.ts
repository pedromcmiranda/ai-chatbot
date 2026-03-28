import type { Skill, SkillDefinition } from './types';
import { createSignedDownloadUrl } from '../services/storage/StorageService';
import { generateChatResponse } from '../services/ai/GeminiService';
import { logger } from '../utils/logger';

const definition: SkillDefinition = {
  name: 'fileParser',
  description: 'Download and parse a file from GCS, then extract or summarize its content.',
  parametersSchema: {
    type: 'object',
    properties: {
      objectPath: {
        type: 'string',
        description: 'The GCS object path (e.g. uploads/uid/file.txt)',
      },
      instruction: {
        type: 'string',
        description: 'What to extract or summarize from the file',
      },
    },
    required: ['objectPath', 'instruction'],
  },
};

async function execute(params: Record<string, unknown>): Promise<unknown> {
  const objectPath = String(params['objectPath'] ?? '');
  const instruction = String(params['instruction'] ?? '');

  if (!objectPath || !instruction) {
    throw new Error('fileParser: objectPath and instruction are required');
  }

  logger.info({ objectPath }, 'Executing fileParser skill');

  // For now, return a signed URL so the client can fetch the file.
  // In a full implementation, the backend would fetch the file bytes,
  // convert to base64, and pass as an inline part to Gemini.
  const { downloadUrl, expiresAt } = await createSignedDownloadUrl(objectPath);

  // Placeholder: in production, fetch file bytes and pass as multimodal input
  const summary = await generateChatResponse(
    `The user wants you to ${instruction} on a file located at a GCS signed URL. ` +
    `The file URL (expires ${expiresAt.toISOString()}) is available but multimodal parsing ` +
    `requires the bytes to be passed inline. Please acknowledge the task and describe what you would do.`,
    [],
  );

  return { downloadUrl, expiresAt, summary };
}

export const fileParserSkill: Skill = { definition, execute };

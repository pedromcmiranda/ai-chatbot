import type { Skill, SkillDefinition } from './types';
import { generateGroundedResponse } from '../services/ai/GroundingService';
import { logger } from '../utils/logger';

const definition: SkillDefinition = {
  name: 'webSearch',
  description: 'Search the web for current information on a topic and return a concise summary.',
  parametersSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up',
      },
    },
    required: ['query'],
  },
};

async function execute(params: Record<string, unknown>): Promise<unknown> {
  const query = String(params['query'] ?? '');

  if (!query) {
    throw new Error('webSearch: query parameter is required');
  }

  logger.info({ query }, 'Executing webSearch skill');

  const { text, groundingMetadata } = await generateGroundedResponse(
    query,
    'You are a research assistant. Provide a concise, factual summary based on current web search results. Include source URLs where relevant.',
  );

  return {
    summary: text,
    sources: groundingMetadata?.groundingChunks
      ?.filter((c) => c.web)
      .map((c) => ({ title: c.web!.title, url: c.web!.uri })) ?? [],
    searchQueries: groundingMetadata?.webSearchQueries ?? [],
  };
}

export const webSearchSkill: Skill = { definition, execute };

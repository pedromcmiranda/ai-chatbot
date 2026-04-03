import {
  VertexAI,
  type GenerateContentRequest,
} from '@google-cloud/vertexai';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../utils/logger';

const PROJECT = process.env.VERTEX_AI_PROJECT ?? '';
const LOCATION = process.env.VERTEX_AI_LOCATION ?? 'us-central1';
const MODEL = 'gemini-3.1-flash-lite-preview';

const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
const tracer = trace.getTracer('grounding-service');

// Google Search Grounding tool definition
const googleSearchTool = {
  googleSearchRetrieval: {},
};

export interface GroundedResponse {
  text: string;
  groundingMetadata?: {
    webSearchQueries?: string[];
    searchEntryPoint?: { renderedContent: string };
    groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
  };
}

export async function generateGroundedResponse(
  prompt: string,
  systemPrompt?: string,
): Promise<GroundedResponse> {
  return tracer.startActiveSpan('gemini.groundedGenerate', async (span) => {
    span.setAttribute('model', MODEL);
    span.setAttribute('grounding', 'google_search');

    try {
      const model = vertexAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: systemPrompt
          ? { role: 'system', parts: [{ text: systemPrompt }] }
          : undefined,
        tools: [googleSearchTool],
      });

      const request: GenerateContentRequest = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const result = await model.generateContent(request);
      const candidate = result.response.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text ?? '';
      const groundingMetadata = candidate?.groundingMetadata as GroundedResponse['groundingMetadata'];

      span.setStatus({ code: SpanStatusCode.OK });
      logger.debug(
        { queries: groundingMetadata?.webSearchQueries },
        'Grounded response generated',
      );

      return { text, groundingMetadata };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      logger.error({ err }, 'Grounding API call failed');
      throw err;
    } finally {
      span.end();
    }
  });
}

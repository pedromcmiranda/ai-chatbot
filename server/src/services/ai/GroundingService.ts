import { GoogleGenAI } from '@google/genai';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../utils/logger';

const MODEL = 'gemini-2.5-flash-lite-preview-06-17';
const tracer = trace.getTracer('grounding-service');

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenAI({ apiKey });
}

export interface GroundedResponse {
  text: string;
  groundingMetadata?: {
    webSearchQueries?: string[];
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
      const ai = getClient();

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text ?? '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata as GroundedResponse['groundingMetadata'];

      span.setStatus({ code: SpanStatusCode.OK });
      logger.debug({ queries: groundingMetadata?.webSearchQueries }, 'Grounded response generated');

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

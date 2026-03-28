import {
  VertexAI,
  type Content,
  type GenerateContentResult,
} from '@google-cloud/vertexai';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../utils/logger';
import type { ChatMessage } from '../../validation/schemas';

const PROJECT = process.env.VERTEX_AI_PROJECT ?? '';
const LOCATION = process.env.VERTEX_AI_LOCATION ?? 'us-central1';
const MODEL = 'gemini-2.0-flash';

const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
const tracer = trace.getTracer('gemini-service');

function toVertexContent(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
}

export async function generateChatResponse(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  return tracer.startActiveSpan('gemini.generateChat', async (span) => {
    span.setAttribute('model', MODEL);
    span.setAttribute('history_length', history.length);

    try {
      const model = vertexAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: systemPrompt
          ? { role: 'system', parts: [{ text: systemPrompt }] }
          : undefined,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      const chat = model.startChat({ history: toVertexContent(history) });

      const result: GenerateContentResult = await chat.sendMessage(userMessage);
      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      span.setStatus({ code: SpanStatusCode.OK });
      logger.debug({ inputChars: userMessage.length, outputChars: text.length }, 'Gemini response generated');

      return text;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      logger.error({ err }, 'Gemini API call failed');
      throw err;
    } finally {
      span.end();
    }
  });
}

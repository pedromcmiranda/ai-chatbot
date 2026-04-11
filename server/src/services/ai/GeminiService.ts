import { GoogleGenAI } from '@google/genai';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../utils/logger';
import type { ChatMessage } from '../../validation/schemas';

const MODEL = 'gemini-2.5-flash-lite-preview-06-17';
const tracer = trace.getTracer('gemini-service');

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenAI({ apiKey });
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
      const ai = getClient();

      const chat = ai.chats.create({
        model: MODEL,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
        history: history.map((m) => ({
          role: m.role,
          parts: [{ text: m.content }],
        })),
      });

      const response = await chat.sendMessage({ message: userMessage });
      const text = response.text ?? '';

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

import path from 'path';
import fs from 'fs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Skill, SkillResult } from '../skills/types';
import { generateChatResponse } from '../services/ai/GeminiService';
import { generateGroundedResponse } from '../services/ai/GroundingService';
import type { ChatMessage } from '../validation/schemas';
import { logger } from '../utils/logger';

const tracer = trace.getTracer('chat-agent');

const SKILLS_DIR = path.resolve(__dirname, '../skills');

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools (skills).
When using a skill, explain what you're doing and incorporate the results naturally into your response.
Always be accurate, concise, and honest about the limits of your knowledge.`;

export class ChatAgent {
  private skills = new Map<string, Skill>();

  constructor() {
    this.loadSkills();
  }

  /**
   * Auto-discovers and loads all skill files from /src/skills/*.ts (or *.js at runtime).
   * Add a new file to the skills directory and it will be picked up on the next startup.
   */
  private loadSkills(): void {
    const ext = process.env.NODE_ENV === 'production' ? '.js' : '.ts';
    const reservedFiles = new Set(['types' + ext, 'index' + ext]);

    try {
      const files = fs
        .readdirSync(SKILLS_DIR)
        .filter((f) => f.endsWith(ext) && !reservedFiles.has(f));

      for (const file of files) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require(path.join(SKILLS_DIR, file)) as Record<string, unknown>;

          // Convention: each skill file exports one or more objects implementing Skill
          for (const exportedValue of Object.values(mod)) {
            if (isSkill(exportedValue)) {
              this.skills.set(exportedValue.definition.name, exportedValue);
              logger.info({ skill: exportedValue.definition.name }, 'Skill loaded');
            }
          }
        } catch (err) {
          logger.error({ err, file }, 'Failed to load skill file');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to read skills directory');
    }

    logger.info({ count: this.skills.size }, 'Skills loaded');
  }

  get availableSkills(): SkillDefinition[] {
    return Array.from(this.skills.values()).map((s) => s.definition);
  }

  async chat(
    message: string,
    history: ChatMessage[],
    options: { useGrounding?: boolean; skillIds?: string[] } = {},
  ): Promise<{ text: string; skillResults?: SkillResult[] }> {
    return tracer.startActiveSpan('chatAgent.chat', async (span) => {
      span.setAttribute('use_grounding', options.useGrounding ?? false);
      span.setAttribute('requested_skills', JSON.stringify(options.skillIds ?? []));

      try {
        // Execute requested skills first
        const skillResults: SkillResult[] = [];
        if (options.skillIds?.length) {
          const results = await Promise.allSettled(
            options.skillIds.map((id) => this.executeSkill(id, { query: message })),
          );

          for (let i = 0; i < results.length; i++) {
            const r = results[i]!;
            const skillId = options.skillIds[i]!;
            if (r.status === 'fulfilled') {
              skillResults.push(r.value);
            } else {
              skillResults.push({ skillName: skillId, result: null, error: String(r.reason) });
            }
          }
        }

        // Build context from skill results
        const skillContext = skillResults.length
          ? `\n\nSkill results:\n${JSON.stringify(skillResults, null, 2)}`
          : '';

        const augmentedMessage = message + skillContext;

        let text: string;
        if (options.useGrounding) {
          const response = await generateGroundedResponse(augmentedMessage, SYSTEM_PROMPT);
          text = response.text;
        } else {
          text = await generateChatResponse(augmentedMessage, history, SYSTEM_PROMPT);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return { text, skillResults: skillResults.length ? skillResults : undefined };
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  private async executeSkill(skillId: string, params: Record<string, unknown>): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { skillName: skillId, result: null, error: `Skill "${skillId}" not found` };
    }

    logger.info({ skillId }, 'Executing skill');
    const result = await skill.execute(params);
    return { skillName: skillId, result };
  }
}

function isSkill(val: unknown): val is Skill {
  return (
    typeof val === 'object' &&
    val !== null &&
    'definition' in val &&
    'execute' in val &&
    typeof (val as Skill).execute === 'function'
  );
}

export type { SkillDefinition } from '../skills/types';

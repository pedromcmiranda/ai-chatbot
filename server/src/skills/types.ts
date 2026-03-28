export interface SkillDefinition {
  name: string;
  description: string;
  /** JSON Schema-compatible parameters (used to build Vertex AI function declarations) */
  parametersSchema: Record<string, unknown>;
}

export interface Skill {
  definition: SkillDefinition;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export type SkillResult = {
  skillName: string;
  result: unknown;
  error?: string;
};

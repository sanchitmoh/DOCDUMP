import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const AI_MODELS = {
  CHAT: process.env.OPENAI_MODEL_CHAT || 'gpt-4o-mini',
  EMBEDDING: process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-large',
  SUMMARY: process.env.OPENAI_MODEL_SUMMARY || 'gpt-4o-mini'
} as const;

export const AI_LIMITS = {
  MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST || '4000'),
  MAX_REQUESTS_PER_HOUR: parseInt(process.env.AI_MAX_REQUESTS_PER_HOUR || '500'),
  CONTEXT_WINDOW: parseInt(process.env.AI_CONTEXT_WINDOW || '128000'),
} as const;
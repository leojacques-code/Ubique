import OpenAI from 'openai';

type AiOptions = { model?: string; maxOutputTokens?: number };

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function modelFor(kind:'default'|'fast'='default') {
  if(kind==='fast') return process.env.OPENAI_FAST_MODEL || 'gpt-5.6-luna';
  return process.env.OPENAI_MODEL || 'gpt-5.6';
}

export async function aiText(instructions: string, input: string, options: AiOptions = {}) {
  const openai = client();
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');
  const response = await openai.responses.create({
    model: options.model || modelFor('default'),
    instructions,
    input,
    max_output_tokens: options.maxOutputTokens ?? 3000,
  });
  return response.output_text?.trim() || '';
}

export async function aiJson<T>(instructions: string, input: string, options: AiOptions = {}): Promise<T> {
  const raw = await aiText(`${instructions}\nReturn valid JSON only. No markdown fences.`, input, { ...options, maxOutputTokens: options.maxOutputTokens ?? 3500 });
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start,end+1)) as T;
}

export const fastModel = () => modelFor('fast');

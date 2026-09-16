import OpenAI from 'openai';

function client() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function aiText(instructions: string, input: string) {
  const openai = client();
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
    instructions,
    input
  });
  return response.output_text?.trim() || '';
}

export async function aiJson<T>(instructions: string, input: string): Promise<T> {
  const raw = await aiText(`${instructions}\nReturn valid JSON only. No markdown fences.`, input);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start,end+1)) as T;
}

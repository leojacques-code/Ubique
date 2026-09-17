import { z } from "zod";
import { rules } from "../prompts/rules";
export async function ai<T>(
  instruction: string,
  context: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
    throw new Error(
      "Configurez OpenAI et OPENAI_MODEL dans les paramètres serveur.",
    );
  const format = z.toJSONSchema(schema);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            rules +
            "\n" +
            instruction +
            "\nRetourne exclusivement un objet JSON conforme à ce schéma: " +
            JSON.stringify(format),
        },
        { role: "user", content: JSON.stringify(context) },
      ],
      response_format: { type: "json_object" },
      store: false,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok)
    throw new Error(
      `OpenAI indisponible (${res.status}). Réessayez plus tard.`,
    );
  const result = await res.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content)
    throw new Error("OpenAI n’a renvoyé aucun contenu exploitable.");
  return schema.parse(JSON.parse(content));
}

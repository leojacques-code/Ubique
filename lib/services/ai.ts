import { z } from "zod";
import { rules } from "../prompts/rules";
type Options = { fast?: boolean; maxOutputTokens?: number };
export async function ai<T>(
  instruction: string,
  context: unknown,
  schema: z.ZodType<T>,
  options: Options = {},
): Promise<T> {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("Configurez OPENAI_API_KEY sur le serveur.");
  const input = JSON.stringify(context);
  if (input.length > 180000)
    throw new Error(
      "Contexte trop volumineux. Réduisez les pièces et sources avant préparation.",
    );
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.fast
        ? process.env.OPENAI_FAST_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-5.6-luna"
        : process.env.OPENAI_MODEL || "gpt-5.6",
      instructions:
        rules +
        "\n" +
        instruction +
        "\nRetourne exclusivement un objet JSON conforme à ce schéma: " +
        JSON.stringify(z.toJSONSchema(schema)),
      input,
      text: { format: { type: "json_object" } },
      max_output_tokens: Math.min(options.maxOutputTokens ?? 6000, 8000),
      store: false,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok)
    throw new Error(
      `OpenAI indisponible (${res.status}). Réessayez plus tard.`,
    );
  const result = await res.json();
  if (result.status !== "completed")
    throw new Error(
      "Réponse IA incomplète. Aucun résultat partiel enregistré.",
    );
  const content = (result.output || [])
    .filter((o: { type: string }) => o.type === "message")
    .flatMap(
      (o: { content: { type: string; text?: string }[] }) => o.content || [],
    )
    .filter((c: { type: string }) => c.type === "output_text")
    .map((c: { text: string }) => c.text)
    .join("");
  if (!content)
    throw new Error("OpenAI n’a renvoyé aucun contenu exploitable.");
  return schema.parse(JSON.parse(content));
}

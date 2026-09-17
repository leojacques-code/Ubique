import { z } from "zod";
import { rules } from "../prompts/rules";
import { resolveAiTarget } from "./aiConfig";

type Options = { fast?: boolean; maxOutputTokens?: number };
type Provider = "openrouter" | "openai";

export function aiTransportPolicy(provider: Provider) {
  return provider === "openrouter"
    ? { attempts: 2, timeoutMs: 120000 }
    : { attempts: 1, timeoutMs: 90000 };
}

function retryableStatus(status: number) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function isTimeout(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function ai<T>(
  instruction: string,
  context: unknown,
  schema: z.ZodType<T>,
  options: Options = {},
): Promise<T> {
  const target = resolveAiTarget(!!options.fast);
  if (!target.apiKey) {
    throw new Error(
      target.provider === "openrouter"
        ? "Configurez OPENROUTER_API_KEY sur le serveur."
        : "Configurez OPENAI_API_KEY sur le serveur.",
    );
  }

  const input = JSON.stringify(context);
  if (input.length > 180000)
    throw new Error(
      "Contexte trop volumineux. Réduisez les pièces et sources avant préparation.",
    );

  const body: Record<string, unknown> = {
    model: target.model,
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
  };
  if (target.providerRouting) body.provider = target.providerRouting;

  const policy = aiTransportPolicy(target.provider);
  let res: Response | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      res = await fetch(target.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${target.apiKey}`,
          "Content-Type": "application/json",
          ...target.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(policy.timeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (
        target.provider === "openrouter" &&
        attempt < policy.attempts &&
        isTimeout(error)
      ) {
        continue;
      }
      if (isTimeout(error)) {
        throw new Error(
          target.provider === "openrouter"
            ? "OpenRouter gratuit a dépassé le délai de réponse après deux tentatives. Réessayez dans quelques instants."
            : "Le fournisseur IA a dépassé le délai de réponse. Réessayez dans quelques instants.",
        );
      }
      throw error;
    }

    if (
      target.provider === "openrouter" &&
      attempt < policy.attempts &&
      retryableStatus(res.status)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      continue;
    }
    break;
  }

  if (!res) {
    if (isTimeout(lastError))
      throw new Error(
        "OpenRouter gratuit a dépassé le délai de réponse. Réessayez dans quelques instants.",
      );
    throw lastError instanceof Error
      ? lastError
      : new Error("Le fournisseur IA n’a pas répondu.");
  }

  if (!res.ok) {
    const label = target.provider === "openrouter" ? "OpenRouter" : "OpenAI";
    throw new Error(`${label} indisponible (${res.status}). Réessayez plus tard.`);
  }

  const result = await res.json();
  if (result.status && result.status !== "completed")
    throw new Error(
      "Réponse IA incomplète. Aucun résultat partiel enregistré.",
    );

  const content =
    (typeof result.output_text === "string" ? result.output_text : "") ||
    (result.output || [])
      .filter((o: { type: string }) => o.type === "message")
      .flatMap(
        (o: { content: { type: string; text?: string }[] }) => o.content || [],
      )
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("");

  if (!content)
    throw new Error("Le fournisseur IA n’a renvoyé aucun contenu exploitable.");
  return schema.parse(JSON.parse(content));
}

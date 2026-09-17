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

function jsonPrompt<T>(instruction: string, schema: z.ZodType<T>) {
  return (
    rules +
    "\n" +
    instruction +
    "\nRetourne exclusivement un objet JSON conforme à ce schéma: " +
    JSON.stringify(z.toJSONSchema(schema))
  );
}

export function aiRequestBody<T>(
  provider: Provider,
  model: string,
  instruction: string,
  input: string,
  schema: z.ZodType<T>,
  maxOutputTokens: number,
  providerRouting?: { data_collection: "allow" | "deny"; zdr?: boolean },
) {
  const prompt = jsonPrompt(instruction, schema);
  if (provider === "openrouter") {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxOutputTokens,
    };
    if (providerRouting) body.provider = providerRouting;
    return body;
  }

  return {
    model,
    instructions: prompt,
    input,
    text: { format: { type: "json_object" } },
    max_output_tokens: maxOutputTokens,
    store: false,
  };
}

function extractContent(provider: Provider, result: any) {
  if (provider === "openrouter") {
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          typeof part === "string"
            ? part
            : typeof part?.text === "string"
              ? part.text
              : "",
        )
        .join("");
    }
    return "";
  }

  return (
    (typeof result.output_text === "string" ? result.output_text : "") ||
    (result.output || [])
      .filter((o: { type: string }) => o.type === "message")
      .flatMap(
        (o: { content: { type: string; text?: string }[] }) => o.content || [],
      )
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("")
  );
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(unfenced);
}

async function apiErrorMessage(res: Response, label: string) {
  let detail = "";
  try {
    const payload = await res.json();
    if (typeof payload?.error?.message === "string") detail = payload.error.message;
    else if (typeof payload?.message === "string") detail = payload.message;
  } catch {
    // Keep the generic error below.
  }
  const safeDetail = detail.replace(/\s+/g, " ").slice(0, 240);
  return safeDetail
    ? `${label} indisponible (${res.status}) : ${safeDetail}`
    : `${label} indisponible (${res.status}). Réessayez plus tard.`;
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

  const maxOutputTokens = Math.min(options.maxOutputTokens ?? 6000, 8000);
  const body = aiRequestBody(
    target.provider,
    target.model,
    instruction,
    input,
    schema,
    maxOutputTokens,
    target.providerRouting,
  );

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
    throw new Error(await apiErrorMessage(res, label));
  }

  const result = await res.json();
  if (
    target.provider === "openai" &&
    result.status &&
    result.status !== "completed"
  )
    throw new Error(
      "Réponse IA incomplète. Aucun résultat partiel enregistré.",
    );

  const content = extractContent(target.provider, result);
  if (!content)
    throw new Error("Le fournisseur IA n’a renvoyé aucun contenu exploitable.");
  return schema.parse(parseJsonContent(content));
}

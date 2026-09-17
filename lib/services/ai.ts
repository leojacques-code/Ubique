import { z } from "zod";
import { rules } from "../prompts/rules";
import { resolveAiTarget } from "./aiConfig";

type Options = { fast?: boolean; maxOutputTokens?: number };
type Provider = "openrouter" | "openai";
type UnknownRecord = Record<string, unknown>;
type ProviderRouting = {
  data_collection: "allow" | "deny";
  zdr?: boolean;
};

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

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function jsonPrompt<T>(instruction: string, schema: z.ZodType<T>) {
  return (
    rules +
    "\n" +
    instruction +
    "\nRetourne exclusivement un objet JSON valide conforme à ce schéma. Aucun markdown, aucune explication autour du JSON: " +
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
  providerRouting?: ProviderRouting,
) {
  const prompt = jsonPrompt(instruction, schema);
  if (provider === "openrouter") {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: input },
      ],
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

function extractContent(provider: Provider, result: unknown) {
  const root = asRecord(result);
  if (!root) return "";

  if (provider === "openrouter") {
    const choices = root.choices;
    if (!Array.isArray(choices) || choices.length === 0) return "";
    const first = asRecord(choices[0]);
    const message = asRecord(first?.message);
    const content = message?.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        const record = asRecord(part);
        return typeof record?.text === "string" ? record.text : "";
      })
      .join("");
  }

  if (typeof root.output_text === "string" && root.output_text) {
    return root.output_text;
  }
  const output = root.output;
  if (!Array.isArray(output)) return "";
  const texts: string[] = [];
  for (const item of output) {
    const message = asRecord(item);
    if (message?.type !== "message" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const content = asRecord(part);
      if (content?.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }
  return texts.join("");
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const first = unfenced.indexOf("{");
    const last = unfenced.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(unfenced.slice(first, last + 1));
    }
    throw new Error("La réponse IA ne contient pas de JSON exploitable.");
  }
}

async function apiErrorMessage(res: Response, label: string) {
  let detail = "";
  try {
    const payload = asRecord(await res.json());
    const error = asRecord(payload?.error);
    if (typeof error?.message === "string") detail = error.message;
    else if (typeof payload?.message === "string") detail = payload.message;
  } catch {
    // Keep the generic error below.
  }
  const safeDetail = detail.replace(/\s+/g, " ").slice(0, 240);
  return safeDetail
    ? `${label} indisponible (${res.status}) : ${safeDetail}`
    : `${label} indisponible (${res.status}). Réessayez plus tard.`;
}

function parseValidated<T>(content: string, schema: z.ZodType<T>): T {
  return schema.parse(parseJsonContent(content));
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
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    let res: Response;
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

    if (!res.ok) {
      if (
        target.provider === "openrouter" &&
        attempt < policy.attempts &&
        retryableStatus(res.status)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      const label = target.provider === "openrouter" ? "OpenRouter" : "OpenAI";
      throw new Error(await apiErrorMessage(res, label));
    }

    const result = await res.json();
    if (target.provider === "openai") {
      const status = asRecord(result)?.status;
      if (typeof status === "string" && status !== "completed") {
        throw new Error(
          "Réponse IA incomplète. Aucun résultat partiel enregistré.",
        );
      }
    }

    const content = extractContent(target.provider, result);
    if (!content.trim()) {
      lastError = new Error("Réponse vide");
      if (target.provider === "openrouter" && attempt < policy.attempts) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw new Error(
        target.provider === "openrouter"
          ? "OpenRouter gratuit a renvoyé deux réponses vides. Réessayez dans quelques instants."
          : "Le fournisseur IA n’a renvoyé aucun contenu exploitable.",
      );
    }

    try {
      return parseValidated(content, schema);
    } catch (error) {
      lastError = error;
      if (target.provider === "openrouter" && attempt < policy.attempts) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw new Error(
        target.provider === "openrouter"
          ? "Le modèle gratuit a répondu, mais pas dans un JSON valide. Réessayez dans quelques instants."
          : "La réponse IA ne respecte pas le format attendu.",
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Le fournisseur IA n’a pas répondu.");
}

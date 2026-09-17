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

const RESULT_TOOL = "submit_ubique_result";
const STRUCTURED_FREE_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export const OPENROUTER_FREE_MODELS = [
  "inclusionai/ling-3.0-flash-fin:free",
  STRUCTURED_FREE_MODEL,
  "inclusionai/ling-3.0-flash:free",
  "inclusionai/ling-3.0-flash-vl:free",
  "openrouter/free",
] as const;

export function openRouterModelCandidates(model: string) {
  if (model === "openrouter/free") return [...OPENROUTER_FREE_MODELS];
  return [model, model];
}

export function aiTransportPolicy(provider: Provider) {
  return provider === "openrouter"
    ? { attempts: 2, timeoutMs: 120000 }
    : { attempts: 1, timeoutMs: 90000 };
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
    "\nAucun markdown, aucune explication autour du JSON." +
    "\nRetourne exclusivement un objet JSON valide conforme à ce schéma: " +
    JSON.stringify(z.toJSONSchema(schema))
  );
}

function usesNativeStructuredOutput(provider: Provider, model: string) {
  return provider === "openrouter" && model === STRUCTURED_FREE_MODEL;
}

function usesForcedToolResult(provider: Provider, model: string) {
  return (
    provider === "openrouter" &&
    !usesNativeStructuredOutput(provider, model) &&
    (model === "openrouter/free" || model.endsWith(":free"))
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

    if (usesNativeStructuredOutput(provider, model)) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "ubique_result",
          strict: true,
          schema: z.toJSONSchema(schema),
        },
      };
    } else if (usesForcedToolResult(provider, model)) {
      body.tools = [
        {
          type: "function",
          function: {
            name: RESULT_TOOL,
            description:
              "Return the final Ubique result exactly matching the requested JSON schema.",
            parameters: z.toJSONSchema(schema),
          },
        },
      ];
      body.tool_choice = {
        type: "function",
        function: { name: RESULT_TOOL },
      };
    }

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

export function extractAiPayload(provider: Provider, result: unknown) {
  const root = asRecord(result);
  if (!root) return "";

  if (provider === "openrouter") {
    const choices = root.choices;
    if (!Array.isArray(choices) || choices.length === 0) return "";
    const first = asRecord(choices[0]);
    const message = asRecord(first?.message);
    const toolCalls = message?.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const call of toolCalls) {
        const fn = asRecord(asRecord(call)?.function);
        if (fn?.name !== RESULT_TOOL) continue;
        const args = fn.arguments;
        if (typeof args === "string" && args.trim()) return args;
        if (args !== undefined) return JSON.stringify(args);
      }
    }

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
  const policy = aiTransportPolicy(target.provider);
  const models =
    target.provider === "openrouter"
      ? openRouterModelCandidates(target.model)
      : [target.model];
  let lastError: unknown;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const hasNext = index < models.length - 1;
    const body = aiRequestBody(
      target.provider,
      model,
      instruction,
      input,
      schema,
      maxOutputTokens,
      target.providerRouting,
    );

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
      if (target.provider === "openrouter" && hasNext) continue;
      if (isTimeout(error)) {
        throw new Error(
          target.provider === "openrouter"
            ? "Les modèles gratuits OpenRouter ont dépassé le délai de réponse. Réessayez dans quelques instants."
            : "Le fournisseur IA a dépassé le délai de réponse. Réessayez dans quelques instants.",
        );
      }
      throw error;
    }

    if (!res.ok) {
      const label = target.provider === "openrouter" ? "OpenRouter" : "OpenAI";
      lastError = new Error(await apiErrorMessage(res, label));
      if (
        target.provider === "openrouter" &&
        hasNext &&
        res.status !== 401 &&
        res.status !== 403
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw lastError;
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

    const content = extractAiPayload(target.provider, result);
    if (!content.trim()) {
      lastError = new Error("Réponse vide");
      if (target.provider === "openrouter" && hasNext) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw new Error(
        target.provider === "openrouter"
          ? "Aucun modèle gratuit OpenRouter n’a renvoyé de résultat exploitable. Réessayez dans quelques instants."
          : "Le fournisseur IA n’a renvoyé aucun contenu exploitable.",
      );
    }

    try {
      return parseValidated(content, schema);
    } catch (error) {
      lastError = error;
      if (target.provider === "openrouter" && hasNext) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw new Error(
        target.provider === "openrouter"
          ? "Les modèles gratuits ont répondu, mais aucun résultat ne respecte le format attendu. Réessayez dans quelques instants."
          : "La réponse IA ne respecte pas le format attendu.",
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Le fournisseur IA n’a pas répondu.");
}

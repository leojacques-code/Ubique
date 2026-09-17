export type AiProvider = "openrouter" | "openai";

type Env = Record<string, string | undefined>;

export type AiTarget = {
  provider: AiProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  headers: Record<string, string>;
  providerRouting?: {
    data_collection: "allow" | "deny";
    zdr?: boolean;
  };
};

function truthy(value?: string) {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

function endpoint(base: string) {
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith("/responses")
    ? normalized
    : `${normalized}/responses`;
}

export function resolveAiProvider(env: Env = process.env): AiProvider {
  const configured = (env.AI_PROVIDER || "").trim().toLowerCase();
  if (configured) {
    if (configured !== "openrouter" && configured !== "openai") {
      throw new Error("AI_PROVIDER doit valoir openrouter ou openai.");
    }
    return configured;
  }
  if (env.OPENROUTER_API_KEY) return "openrouter";
  return "openai";
}

export function resolveAiTarget(
  fast = false,
  env: Env = process.env,
): AiTarget {
  const provider = resolveAiProvider(env);

  if (provider === "openrouter") {
    const model = fast
      ? env.OPENROUTER_FAST_MODEL ||
        env.AI_FAST_MODEL ||
        env.OPENROUTER_MODEL ||
        env.AI_MODEL ||
        "openrouter/free"
      : env.OPENROUTER_MODEL || env.AI_MODEL || "openrouter/free";
    const apiKey = env.OPENROUTER_API_KEY || "";
    const headers: Record<string, string> = {};
    if (env.APP_URL) headers["HTTP-Referer"] = env.APP_URL;
    headers["X-Title"] = "Ubique";
    return {
      provider,
      apiKey,
      endpoint: endpoint(
        env.OPENROUTER_BASE_URL ||
          env.AI_BASE_URL ||
          "https://openrouter.ai/api/v1",
      ),
      model,
      headers,
      providerRouting: {
        data_collection:
          (env.OPENROUTER_DATA_COLLECTION || "deny").toLowerCase() === "allow"
            ? "allow"
            : "deny",
        ...(truthy(env.OPENROUTER_ZDR) ? { zdr: true } : {}),
      },
    };
  }

  return {
    provider,
    apiKey: env.OPENAI_API_KEY || "",
    endpoint: endpoint(
      env.OPENAI_BASE_URL || env.AI_BASE_URL || "https://api.openai.com/v1",
    ),
    model: fast
      ? env.OPENAI_FAST_MODEL ||
        env.AI_FAST_MODEL ||
        env.OPENAI_MODEL ||
        env.AI_MODEL ||
        "gpt-5.6-luna"
      : env.OPENAI_MODEL || env.AI_MODEL || "gpt-5.6",
    headers: {},
  };
}

export function aiConfigured(env: Env = process.env) {
  try {
    return !!resolveAiTarget(false, env).apiKey;
  } catch {
    return false;
  }
}

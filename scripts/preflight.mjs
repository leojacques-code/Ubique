const groups = [
  ["Core production", ["APP_URL", "APP_SESSION_SECRET"]],
  [
    "Google interactive",
    [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "ALLOWED_GOOGLE_EMAIL",
    ],
  ],
  ["Google background", ["CRON_SECRET"]],
  ["Google storage pinning", ["GOOGLE_SPREADSHEET_ID"]],
  ["Web research optional", ["TAVILY_API_KEY"]],
];

const configuredProvider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
const aiProvider = configuredProvider ||
  (process.env.OPENROUTER_API_KEY ? "openrouter" : "openai");
const validProvider = aiProvider === "openrouter" || aiProvider === "openai";
const aiKeySet = validProvider &&
  (aiProvider === "openrouter"
    ? !!process.env.OPENROUTER_API_KEY
    : !!process.env.OPENAI_API_KEY);
const aiModelSet = aiProvider === "openrouter"
  ? !!(process.env.OPENROUTER_MODEL || process.env.AI_MODEL || "openrouter/free")
  : !!(process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5.6");
const googleBackgroundSet = !!(
  process.env.GOOGLE_REFRESH_TOKEN_ENCRYPTED || process.env.GOOGLE_REFRESH_TOKEN
);

let missingCore = false;
console.log("Ubique environment preflight (values are never printed)");
for (const [label, keys] of groups) {
  const states = keys.map(
    (key) => `${key}=${process.env[key] ? "SET" : "MISSING"}`,
  );
  console.log(`- ${label}: ${states.join(" | ")}`);
  if (label === "Core production" && keys.some((key) => !process.env[key]))
    missingCore = true;
}
console.log(
  `- AI: provider=${validProvider ? aiProvider : "INVALID"} | key=${aiKeySet ? "SET" : "MISSING"} | model=${aiModelSet ? "SET" : "MISSING"}`,
);
console.log(
  `- Google background token: ${googleBackgroundSet ? "SET" : "MISSING"}`,
);

const strict = process.argv.includes("--strict");
if (strict && missingCore) {
  console.error(
    "Strict preflight failed: production core variables are missing.",
  );
  process.exit(1);
}

if (!validProvider)
  console.log("Note: AI_PROVIDER must be openrouter or openai.");
else if (!aiKeySet)
  console.log(
    aiProvider === "openrouter"
      ? "Note: AI preparation will be unavailable until OPENROUTER_API_KEY is set."
      : "Note: AI preparation will be unavailable until OPENAI_API_KEY is set.",
  );
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
  console.log(
    "Note: Google-connected writes remain unavailable; demo mode can still render.",
  );
if (!googleBackgroundSet)
  console.log(
    "Note: unattended Gmail/watch cron jobs cannot access Google yet.",
  );

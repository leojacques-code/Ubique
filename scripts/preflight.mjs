const groups = [
  ["Core production", ["APP_URL", "APP_SESSION_SECRET"]],
  ["OpenAI", ["OPENAI_API_KEY", "OPENAI_MODEL"]],
  [
    "Google interactive",
    [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "ALLOWED_GOOGLE_EMAIL",
    ],
  ],
  ["Google background", ["GOOGLE_REFRESH_TOKEN", "CRON_SECRET"]],
  ["Google storage pinning", ["GOOGLE_SPREADSHEET_ID"]],
  ["Web research optional", ["TAVILY_API_KEY"]],
];

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

const strict = process.argv.includes("--strict");
if (strict && missingCore) {
  console.error(
    "Strict preflight failed: production core variables are missing.",
  );
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY)
  console.log(
    "Note: AI preparation will be unavailable until OPENAI_API_KEY is set.",
  );
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
  console.log(
    "Note: Google-connected writes remain unavailable; demo mode can still render.",
  );
if (!process.env.GOOGLE_REFRESH_TOKEN)
  console.log(
    "Note: unattended Gmail/watch cron jobs cannot access Google yet.",
  );

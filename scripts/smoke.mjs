const base = (process.argv[2] || process.env.APP_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: npm run smoke -- https://your-ubique.vercel.app");
  process.exit(1);
}

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const commonHeaders = {
  "User-Agent": "Ubique-Smoke/1.0",
  ...(bypass
    ? {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {}),
};

let failed = false;
function fail(message) {
  console.error(`FAIL ${message}`);
  failed = true;
}
function ok(message) {
  console.log(`OK   ${message}`);
}

async function fetchCheck(path, init = {}) {
  return fetch(`${base}${path}`, {
    redirect: "follow",
    ...init,
    headers: { ...commonHeaders, ...(init.headers || {}) },
  });
}

try {
  const res = await fetchCheck("/api/health");
  if (!res.ok) {
    fail(`/api/health: HTTP ${res.status}`);
  } else {
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) fail("/api/health: expected JSON");
    else {
      const data = await res.json();
      if (data?.ok !== true) fail("/api/health: ok !== true");
      else
        ok(
          `/api/health: mode=${data.mode || "unknown"} commit=${data.commit || "n/a"}`,
        );
      const serialized = JSON.stringify(data);
      if (/sk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(serialized))
        fail("/api/health exposed an API-key-like value");
    }
  }
} catch (error) {
  fail(
    `/api/health: ${error instanceof Error ? error.message : String(error)}`,
  );
}

for (const path of ["/", "/opportunities", "/pipeline", "/settings"]) {
  try {
    const res = await fetchCheck(path);
    if (!res.ok) {
      fail(`${path}: HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    if (!text.trim()) {
      fail(`${path}: empty response`);
      continue;
    }
    if (
      !/Ubique|Finance applications|Opportunit|Pipeline|Paramètres/i.test(text)
    )
      fail(`${path}: expected Ubique page markers not found`);
    else ok(`${path}: HTTP ${res.status}`);
    const robots = (res.headers.get("x-robots-tag") || "").toLowerCase();
    if (!robots.includes("noindex"))
      fail(`${path}: missing X-Robots-Tag noindex`);
    const frame = (res.headers.get("x-frame-options") || "").toUpperCase();
    if (frame !== "DENY") fail(`${path}: missing X-Frame-Options DENY`);
  } catch (error) {
    fail(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const res = await fetchCheck("/api/applications");
  if (res.status !== 401)
    fail(`/api/applications GET: expected private 401, got ${res.status}`);
  else ok("/api/applications GET: private data protected");
} catch (error) {
  fail(
    `/api/applications GET: ${error instanceof Error ? error.message : String(error)}`,
  );
}

for (const [label, path, body] of [
  [
    "applications POST",
    "/api/applications",
    { company: "Smoke Test", jobTitle: "Do not create" },
  ],
  [
    "action POST",
    "/api/action",
    { action: "mark-sent", applicationId: "smoke-test" },
  ],
]) {
  try {
    const res = await fetchCheck(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status !== 401)
      fail(`${label}: expected unauthenticated 401, got ${res.status}`);
    else ok(`${label}: unauthenticated write blocked`);
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const path of ["/api/cron/watch", "/api/cron/gmail-sync"]) {
  try {
    const res = await fetchCheck(path);
    if (res.status !== 401)
      fail(`${path}: expected 401 without CRON_SECRET, got ${res.status}`);
    else ok(`${path}: unauthenticated cron blocked`);
  } catch (error) {
    fail(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  console.error("Ubique remote smoke test failed.");
  process.exit(1);
}
console.log("Ubique remote smoke test passed.");

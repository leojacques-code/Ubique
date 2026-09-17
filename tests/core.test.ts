import test from "node:test";
import assert from "node:assert/strict";
import {
  encrypt,
  decrypt,
  equal,
  businessDate,
  fingerprint,
  gmailTerm,
  safeUrl,
} from "../lib/security";
import { fold } from "../lib/repositories/store";
import { mayAutoApply } from "../lib/services/gmailSyncService";
import { validateEvidence } from "../lib/services/applicationService";
import { resolveAiTarget } from "../lib/services/aiConfig";
import { googleEndpoint } from "../lib/google";
import { demoSnapshot } from "../lib/demo";
import { defaultProfile } from "../lib/types";
import { parseCsv } from "../lib/client-utils";
import { renderPdf } from "../lib/services/documentService";
import { PDFDocument } from "pdf-lib";
test("encrypted session authenticates content; tampering rejected", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  const sealed = encrypt({ refreshToken: "test-private" });
  assert.equal(
    decrypt<{ refreshToken: string }>(sealed).refreshToken,
    "test-private",
  );
  const bytes = Buffer.from(sealed, "base64url");
  bytes[30] ^= 1;
  assert.throws(() => decrypt(bytes.toString("base64url")));
  assert(!sealed.includes("test-private"));
  assert.equal(equal("a", "aa"), false);
});
test("append-only replay preserves concurrent field patches and deduplicates events", () => {
  const rows = [
    ["e1", "a", "", "create", '{"status":"Inbox","notes":"original"}'],
    ["e2", "a", "", "patch", '{"status":"Envoyée"}'],
    ["e3", "a", "", "patch", '{"notes":"edited"}'],
    ["e2", "a", "", "patch", '{"status":"Inbox"}'],
  ];
  const result = fold(rows);
  assert.deepEqual(result, [{ id: "a", status: "Envoyée", notes: "edited" }]);
});
test("dedup does not merge internship and CDI", () => {
  const base = {
    company: "Atlas",
    jobTitle: "Analyst",
    location: "Paris",
    reference: "",
    startDate: "2027-01",
  };
  assert.notEqual(
    fingerprint({ ...base, contractType: "CDI" }),
    fingerprint({ ...base, contractType: "Stage" }),
  );
});
test("confidence, terminal status and process progress gate automated transitions", () => {
  const app = demoSnapshot().applications[2];
  assert.equal(mayAutoApply(app, "INTERVIEW_INVITE", 0.7, 0.92), false);
  assert.equal(mayAutoApply(app, "INTERVIEW_INVITE", 0.98, 0.92), true);
  assert.equal(
    mayAutoApply({ ...app, status: "Offre" }, "REJECTION", 1, 0.92),
    false,
  );
  assert.equal(
    mayAutoApply(
      { ...app, status: "En process" },
      "APPLICATION_CONFIRMATION",
      1,
      0.92,
    ),
    false,
  );
  assert.equal(
    mayAutoApply({ ...app, applicationDate: "" }, "REJECTION", 1, 0.92),
    false,
  );
  assert.equal(mayAutoApply(app, "JOB_ALERT", 1, 0.92), false);
});
test("invented evidence and unsupported claims are blocked", () => {
  assert.throws(() =>
    validateEvidence(
      [{ type: "DIRECT", evidenceIds: ["fake"] }],
      defaultProfile,
    ),
  );
  assert.throws(() =>
    validateEvidence([{ type: "DIRECT", evidenceIds: [] }], defaultProfile),
  );
  assert.doesNotThrow(() =>
    validateEvidence(
      [{ type: "NOT_DEMONSTRATED", evidenceIds: [] }],
      defaultProfile,
    ),
  );
});
test("business-day follow-up and untrusted links", () => {
  assert.equal(businessDate("2026-09-18T10:00:00Z", 5), "2026-09-25");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("http://foo.com"), "");
  assert(!gmailTerm('Atlas" OR {test}\n').includes("\n"));
});
test("CSV keeps quoted commas and multiline job descriptions", () => {
  const rows = parseCsv(
    'company,jobTitle,description\nAtlas,Analyst,"Hello, world\nSecond line"',
  );
  assert.equal(rows[0].description, "Hello, world\nSecond line");
});
test("Google API routing uses the dedicated Sheets host", () => {
  assert.equal(
    googleEndpoint("sheets/v4/spreadsheets"),
    "https://sheets.googleapis.com/v4/spreadsheets",
  );
  assert.equal(
    googleEndpoint("drive/v3/files"),
    "https://www.googleapis.com/drive/v3/files",
  );
});
test("free AI defaults to OpenRouter with privacy-conscious routing", () => {
  const target = resolveAiTarget(false, {
    OPENROUTER_API_KEY: "test-key",
    APP_URL: "https://ubique.example",
  });
  assert.equal(target.provider, "openrouter");
  assert.equal(target.endpoint, "https://openrouter.ai/api/v1/responses");
  assert.equal(target.model, "openrouter/free");
  assert.equal(target.providerRouting?.data_collection, "deny");
  assert.equal(target.providerRouting?.zdr, undefined);
  assert.equal(target.headers["X-Title"], "Ubique");
});
test("AI provider can explicitly switch back to OpenAI", () => {
  const target = resolveAiTarget(true, {
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
  });
  assert.equal(target.provider, "openai");
  assert.equal(target.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(target.model, "gpt-5.6-luna");
  assert.equal(target.providerRouting, undefined);
});
test("letter export really is one A4 page; overflow blocked", async () => {
  const pdf = await PDFDocument.load(
    await renderPdf(
      "Bonjour,\n\n" +
        "Une phrase factuelle et précise. ".repeat(65) +
        "\n\nBien cordialement,",
    ),
  );
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(Math.round(pdf.getPage(0).getWidth()), 595);
  await assert.rejects(() => renderPdf("word ".repeat(3000)));
});

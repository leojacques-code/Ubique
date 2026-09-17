import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  legacyRows,
  legacyDocuments,
  legacyContacts,
} from "../lib/repositories/legacy";
import { fold, SheetsRepository } from "../lib/repositories/store";
import { publicUrl, publicAddress } from "../lib/public-url";
import { rankOccurrences, normalizeJobUrl } from "../lib/services/occurrences";
import { validateEvidence } from "../lib/services/applicationService";
import { defaultProfile, type Application, type Contact } from "../lib/types";
import { ai } from "../lib/services/ai";
import { draft } from "../lib/services/gmailService";
import { encrypt, decrypt, businessDate } from "../lib/security";
import { addJob } from "../lib/services/jobService";

test("legacy rows and generated texts survive appended patches and reload", async () => {
  const rows = [
    [
      "id",
      "company",
      "jobTitle",
      "vertical",
      "jobSnapshot",
      "coverLetter",
      "status",
      "jobAnalysis",
      "evidenceMap",
    ],
    [
      "123",
      "Atlas",
      "Analyst",
      '["Private Equity"]',
      "Full original job",
      "Original letter",
      "Envoyée",
      '{"missions":["Analyse"],"timingIssues":["Convention inconnue"]}',
      '[{"requirement":"PE","evidence":"M&A","source":"CV","evidenceType":"TRANSFERABLE"}]',
    ],
    ["event1", "123", "", "patch", '{"notes":"New note"}'],
  ];
  const decoded = legacyRows("Applications", rows);
  const result = fold<Application>(
    decoded.events,
    decoded.seeds as Application[],
  );
  assert.equal(result[0].id, "123");
  assert.equal(result[0].notes, "New note");
  assert.equal(result[0].description, "Full original job");
  assert.equal(result[0].analysis?.timingIssues?.[0], "Convention inconnue");
  assert.equal(result[0].legacyEvidenceMap?.[0].source, "CV");
  assert.equal(legacyDocuments(result).length, 2);
  const original = global.fetch;
  const docs: string[][] = [];
  global.fetch = async (url, init) => {
    if (String(url).includes("Applications!"))
      return Response.json({ values: rows });
    if (String(url).includes(":append")) {
      docs.push(...JSON.parse(String(init?.body)).values);
      return Response.json({});
    }
    return Response.json({ values: docs });
  };
  try {
    const repo = new SheetsRepository("test", "Documents", "test");
    const old = await repo.findById("legacy-123-LM");
    assert(old);
    const saved = await repo.update(old.id, { updatedAt: "changed" });
    assert.equal((await repo.findById(old.id))?.updatedAt, saved.updatedAt);
    await repo.remove(old.id);
    assert.equal(await repo.findById(old.id), undefined);
    assert.equal(rows.length, 3);
  } finally {
    global.fetch = original;
  }
});

test("SSRF guard rejects local, mapped IPv6 and nonstandard endpoints", () => {
  for (const url of [
    "https://localhost/a",
    "https://127.1/",
    "https://2130706433/",
    "https://169.254.169.254/",
    "https://[::ffff:127.0.0.1]/",
    "https://[::1]/",
    "https://[fd00::1]/",
    "https://metadata.google.internal/",
    "https://example.com:444/",
    "https://user:pass@example.com/",
  ])
    assert.equal(publicUrl(url), "", url);
  assert.equal(publicAddress("::ffff:7f00:1"), false);
  assert.equal(publicAddress("10.0.0.1"), false);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(
    publicUrl("https://careers.example.com/job/123"),
    "https://careers.example.com/job/123",
  );
});

test("academic and transferable evidence cannot be promoted to direct experience", () => {
  for (const type of ["ACADEMIC", "TRANSFERABLE"] as const)
    assert.throws(() =>
      validateEvidence([{ type: "DIRECT", evidenceIds: ["e1"] }], {
        ...defaultProfile,
        evidence: [
          { id: "e1", category: "Finance", fact: "LBO", source: "CV", type },
        ],
      }),
    );
});

test("official ATS occurrences precede syndication and only tracking is stripped", () => {
  const app = { company: "Atlas", jobTitle: "Analyst", reference: "R123" };
  const source = {
    title: "Atlas Analyst R123",
    content: "Analyst",
    checkedAt: "",
  };
  const result = rankOccurrences(
    [
      { ...source, url: "https://linkedin.com/jobs/view/123" },
      { ...source, url: "https://boards.greenhouse.io/atlas/jobs/123" },
      {
        ...source,
        url: "https://boards.greenhouse.io/atlas/jobs/123?utm_source=test",
      },
    ],
    app,
  );
  assert.equal(result.length, 2);
  assert(result[0].url.includes("greenhouse"));
  assert.notEqual(
    normalizeJobUrl("https://careers.example.com/job?id=1"),
    normalizeJobUrl("https://careers.example.com/job?id=2"),
  );
});

test("Responses selects fast model, validates output and refuses partial results", async () => {
  const original = global.fetch;
  process.env.OPENAI_API_KEY = "test";
  process.env.OPENAI_MODEL = "main-test";
  process.env.OPENAI_FAST_MODEL = "fast-test";
  let incomplete = false,
    calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const req = JSON.parse(String(init?.body));
    assert.equal(req.model, "fast-test");
    assert.equal(req.store, false);
    assert.equal(req.max_output_tokens, 900);
    return Response.json({
      status: incomplete ? "incomplete" : "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"ok":true}' }],
        },
      ],
    });
  };
  try {
    assert.deepEqual(
      await ai("Test", {}, z.object({ ok: z.boolean() }), {
        fast: true,
        maxOutputTokens: 900,
      }),
      { ok: true },
    );
    incomplete = true;
    await assert.rejects(
      () =>
        ai("Test", {}, z.object({ ok: z.boolean() }), {
          fast: true,
          maxOutputTokens: 900,
        }),
      /incomplète/,
    );
    await assert.rejects(
      () => ai("Test", "x".repeat(180001), z.object({ ok: z.boolean() })),
      /volumineux/,
    );
    assert.equal(calls, 2);
  } finally {
    global.fetch = original;
  }
});

test("Gmail creates only a draft and rejects injected headers before network", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://www.googleapis.com/gmail/v1/users/me/drafts",
    );
    const mime = Buffer.from(
      JSON.parse(String(init?.body)).message.raw,
      "base64url",
    ).toString();
    assert(mime.includes("To: recruiter@example.com"));
    assert(mime.includes("Content-Disposition: attachment"));
    return Response.json({
      id: "draft1",
      message: { id: "m1", threadId: "t1" },
    });
  };
  try {
    assert.equal(
      (
        await draft("test", "recruiter@example.com", "Candidature", "Bonjour", [
          {
            name: "letter.pdf",
            mime: "application/pdf",
            bytes: new Uint8Array([1, 2]),
          },
        ])
      ).id,
      "draft1",
    );
    await assert.rejects(() =>
      draft(
        "test",
        "recruiter@example.com",
        "Hello\r\nBcc: other@example.com",
        "Body",
      ),
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test("existing session secret and Europe Paris date work without new credentials", () => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
  process.env.APP_SESSION_SECRET = "test-session-".repeat(4);
  assert.deepEqual(decrypt(encrypt({ owner: "test" })), { owner: "test" });
  assert.equal(businessDate("2026-09-17T23:30:00Z", 1), "2026-09-21");
});

test("exact URL duplicate reopens existing dossier without AI or another snapshot", async () => {
  const original = global.fetch;
  process.env.GOOGLE_SPREADSHEET_ID = "test";
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json({
      values: [
        [
          "e1",
          "a1",
          "",
          "create",
          JSON.stringify({
            id: "a1",
            officialUrl: "https://careers.example.com/job?id=7",
            sources: [],
            company: "Atlas",
          }),
        ],
      ],
    });
  };
  try {
    const app = await addJob("test", {
      url: "https://careers.example.com/job?utm_source=linkedin&id=7",
    });
    assert.equal(app.id, "a1");
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test("embedded legacy contacts retain sourced email status without mixing documents", () => {
  const app = {
    id: "legacy-app",
    createdAt: "",
    updatedAt: "",
    company: "Atlas",
    contacts: [
      {
        id: "c1",
        name: "Alice",
        role: "RH",
        email: "alice@example.com",
        emailStatus: "Public vérifié",
        source: "https://example.com/team",
      },
    ],
  };
  const contacts = legacyContacts([app]) as Contact[];
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].emailStatus, "VERIFIED_PUBLIC");
  assert.equal(contacts[0].applicationId, "legacy-app");
  assert.equal(legacyDocuments([app]).length, 0);
});

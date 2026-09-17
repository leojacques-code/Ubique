import test from "node:test";
import assert from "node:assert/strict";
import { prepare } from "../lib/services/applicationService";
import { gmailSync } from "../lib/services/gmailSyncService";
import { addJob } from "../lib/services/jobService";
import { SheetsRepository } from "../lib/repositories/store";
import { demoSnapshot } from "../lib/demo";
import {
  defaultProfile,
  defaultSettings,
  type Application,
  type Document,
  type Interaction,
} from "../lib/types";
function mockProviders() {
  const app = {
    ...demoSnapshot().applications[0],
    id: "a1",
    company: "Atlas",
    jobTitle: "Analyste investissement",
    description: "Atlas recherche un analyste investissement Paris",
    reference: "REF12345",
    isWatch: false,
    applicationDate: "2026-09-01T00:00:00Z",
    status: "Envoyée" as const,
  };
  const rows: Record<string, string[][]> = {};
  let i = 0;
  const seed = (table: string, value: { id: string }) => {
    (rows[table] ||= []).push([
      "e" + i++,
      value.id,
      "",
      "create",
      JSON.stringify(value),
    ]);
  };
  seed("Applications", app);
  seed("Profile", {
    ...defaultProfile,
    name: "Candidat fictif",
    updatedAt: "2026-09-01",
    evidence: [
      {
        id: "ev1",
        category: "Expérience",
        fact: "Analyse financière M&A.",
        source: "cv-test.pdf",
        type: "DIRECT",
      },
    ],
  });
  seed("Settings", defaultSettings);
  const original = global.fetch;
  let classificationCalls = 0;
  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("sheets/v4/")) {
      const table = url.split("/values/")[1]?.split("!")[0];
      assert(table);
      if (url.includes(":append")) {
        const b = JSON.parse(String(init?.body));
        (rows[table] ||= []).push(...b.values);
        return Response.json({ updatedRows: 1 });
      }
      return Response.json({ values: rows[table] || [] });
    }
    if (url.includes("api.tavily.com/search"))
      return Response.json({
        results: [
          {
            url: "https://example.com/atlas",
            title: "Atlas official",
            content: "Atlas réalise des investissements en France.",
          },
        ],
      });
    if (url.includes("gmail/v1/users/me/messages?"))
      return Response.json({ messages: [{ id: "m1" }] });
    if (url.includes("gmail/v1/users/me/messages/m1"))
      return Response.json({
        id: "m1",
        threadId: "t1",
        internalDate: String(Date.parse("2026-09-16T09:00:00Z")),
        labelIds: ["INBOX"],
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "subject", value: "Atlas REF12345 Entretien" },
            { name: "from", value: "recruteur@example.com" },
          ],
          body: {
            data: Buffer.from(
              "Atlas REF12345 : nous vous proposons un entretien pour Analyste investissement.",
            ).toString("base64url"),
          },
        },
      });
    if (url.includes("api.openai.com")) {
      const b = JSON.parse(String(init?.body));
      const system = b.messages[0].content;
      const schema = JSON.parse(system.split("schéma: ")[1]);
      const fields = schema.properties;
      let answer: unknown;
      if (fields.summary)
        answer = {
          summary: "Analyse de l’offre Atlas",
          missions: ["Analyse"],
          mustHave: ["Analyse financière"],
          niceToHave: [],
          recruiterTests: ["Rigueur"],
          matches: [
            {
              requirement: "Analyse",
              evidenceIds: ["ev1"],
              type: "TRANSFERABLE",
              explanation: "M&A transférable",
            },
          ],
          strengths: ["Analyse financière"],
          gaps: ["PE non démontré"],
          forbiddenClaims: ["Expérience professionnelle PE"],
          cvLanguage: "FR",
          fitScore: 65,
          fitDetails: [{ dimension: "Technique", score: 7, reason: "M&A" }],
          strategy: "ATS",
          companyFacts: [
            {
              fact: "Investissements en France",
              sourceUrl: "https://example.com/atlas",
            },
          ],
        };
      else if (fields.contacts) answer = { contacts: [] };
      else if (fields.coverLetter)
        answer = {
          coverLetter: Array(410).fill("analyse").join(" "),
          emailSubject: "Candidature analyste",
          email:
            "Bonjour, mon expérience M&A est transférable. Bien cordialement,",
          linkedinConnection:
            "Bonjour, je souhaite échanger au sujet du poste.",
          linkedinMessage: "Bonjour, je candidate chez Atlas.",
          inmail: "Bonjour, je souhaite candidater.",
          claims: [
            { claim: "Expérience M&A", evidenceIds: ["ev1"], sourceUrls: [] },
          ],
        };
      else if (fields.passed) answer = { passed: true, issues: [] };
      else if (fields.classification) {
        classificationCalls++;
        answer = {
          applicationId: "a1",
          classification: "INTERVIEW_INVITE",
          confidence: 0.99,
          detectedStage: "Entretien 1",
          suggestedAction: "Confirmer les disponibilités",
          reason: "Référence exacte",
        };
      } else throw new Error("Unexpected AI schema");
      return Response.json({
        choices: [{ message: { content: JSON.stringify(answer) } }],
      });
    }
    throw new Error("Unexpected request: " + url);
  };
  process.env.GOOGLE_SPREADSHEET_ID = "test";
  process.env.OPENAI_API_KEY = "test";
  process.env.OPENAI_MODEL = "test";
  process.env.TAVILY_API_KEY = "test";
  return {
    rows,
    app,
    restore() {
      global.fetch = original;
    },
    classificationCalls: () => classificationCalls,
  };
}
test("preparation persists three versioned documents and sourced analysis", async () => {
  const mock = mockProviders();
  try {
    await prepare("test", "a1");
    const docs = await new SheetsRepository<Document>(
      "test",
      "Documents",
    ).findAll();
    assert.equal(docs.length, 3);
    assert.deepEqual(
      docs.map((d) => d.type),
      ["LM", "Email", "LinkedIn"],
    );
    const app = await new SheetsRepository<Application>(
      "test",
      "Applications",
    ).findById("a1");
    assert.equal(app?.status, "Envoyée");
    assert.equal(app?.analysis?.matches[0].evidenceIds[0], "ev1");
    assert.ok(app?.gmailCheckedAt);
  } finally {
    mock.restore();
  }
});
test("Gmail replay is idempotent and preserves progressed status", async () => {
  const mock = mockProviders();
  try {
    await gmailSync("test");
    await gmailSync("test");
    const events = await new SheetsRepository<Interaction>(
      "test",
      "Interactions",
    ).findAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].completed, true);
    assert.equal(mock.classificationCalls(), 1);
    const app = await new SheetsRepository<Application>(
      "test",
      "Applications",
    ).findById("a1");
    assert.equal(app?.status, "En process");
    assert.equal(app?.stage, "Entretien 1");
  } finally {
    mock.restore();
  }
});
test("interrupted Gmail decision is completed on the next synchronization", async () => {
  const mock = mockProviders();
  try {
    await new SheetsRepository<Interaction>("test", "Interactions").create({
      id: "pending",
      createdAt: "",
      updatedAt: "",
      applicationId: "a1",
      type: "Gmail",
      summary: "Decision",
      gmailMessageId: "m1",
      completed: false,
      oldStatus: "Envoyée",
      newStatus: "En process",
      proposedPatch: {
        status: "En process",
        lastInteraction: "2026-09-16T09:00:00Z",
      },
    });
    await gmailSync("test");
    assert.equal(
      (
        await new SheetsRepository<Application>(
          "test",
          "Applications",
        ).findById("a1")
      )?.status,
      "En process",
    );
    assert.equal(
      (
        await new SheetsRepository<Interaction>(
          "test",
          "Interactions",
        ).findById("pending")
      )?.completed,
      true,
    );
  } finally {
    mock.restore();
  }
});
test("manual CRUD remains available without OpenAI", async () => {
  const mock = mockProviders();
  try {
    delete process.env.OPENAI_API_KEY;
    const app = await addJob("test", {
      company: "Fictive société",
      jobTitle: "Analyste",
      description: "Texte collé de la fiche.",
    });
    assert.equal(app.company, "Fictive société");
    assert.equal(app.status, "À analyser");
  } finally {
    mock.restore();
  }
});

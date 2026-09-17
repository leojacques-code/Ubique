import { defaultProfile, defaultSettings, type Entity } from "../types";
// Legacy rows stay intact. Subsequent journal events are overlaid in physical order.
export function legacyRows(
  table: string,
  rows: string[][],
): { seeds: Entity[]; events: string[][] } {
  if (!rows.length) return { seeds: [], events: [] };
  const headers = rows[0];
  if (headers[0] === "eventId") return { seeds: [], events: rows.slice(1) };
  const isEvent = (r: string[]) =>
    ["create", "patch", "delete"].includes(r[3]) && r[4]?.startsWith("{");
  if (isEvent(headers)) return { seeds: [], events: rows }; // Headerless journals from earlier local builds.
  if (!headers.includes("id")) {
    if (rows.every((r) => r.every((c) => !c))) return { seeds: [], events: [] };
    throw new Error(
      `Format Sheets inconnu pour ${table}. Aucune donnée modifiée.`,
    );
  }
  const seeds = rows
    .slice(1)
    .filter((r) => !isEvent(r) && r.some(Boolean))
    .map((row) => {
      const raw: Record<string, unknown> = Object.fromEntries(
        headers.map((h, i) => {
          const v = row[i] || "";
          try {
            return [
              h,
              /^[{[]/.test(v) ||
              [
                "fitScore",
                "salaryMin",
                "salaryMax",
                "coverLetterReady",
                "emailReady",
                "linkedinReady",
                "formReady",
                "alumniSkema",
              ].includes(h)
                ? JSON.parse(v)
                : v,
            ];
          } catch {
            return [h, v];
          }
        }),
      );
      const base = {
        ...raw,
        id: String(raw.id || ""),
        createdAt: String(raw.createdAt || ""),
        updatedAt: String(raw.updatedAt || ""),
      };
      if (table === "Applications") {
        const urls = Array.isArray(raw.sourceUrls) ? raw.sourceUrls : [];
        const job = raw.jobAnalysis as Record<string, unknown> | undefined;
        return {
          location: "",
          contractType: "",
          startDate: "",
          reference: "",
          priority: "B",
          careerPriority: "",
          stage: "Candidature",
          status: "À analyser",
          officialUrl: "",
          publicationDate: "",
          deadline: "",
          applicationDate: "",
          lastInteraction: "",
          nextAction: "",
          nextActionDate: "",
          notes: "",
          isWatch: false,
          ignored: false,
          ...base,
          vertical: Array.isArray(raw.vertical)
            ? raw.vertical.join(" / ")
            : raw.vertical || "",
          description: raw.description || raw.jobSnapshot || "",
          sources: [...new Set([raw.officialUrl, ...urls].filter(Boolean))].map(
            (url) => ({
              url,
              title: raw.jobTitle || "Source importée",
              content: "",
              checkedAt: raw.updatedAt || "",
            }),
          ),
          analysis:
            raw.analysis ||
            (job
              ? {
                  summary: "Analyse importée",
                  missions: [],
                  mustHave: [],
                  niceToHave: [],
                  recruiterTests: [],
                  timingIssues: [],
                  ...job,
                  matches: [],
                  strengths: raw.strengths || [],
                  gaps: raw.gaps || [],
                  forbiddenClaims: [],
                  cvLanguage: raw.cvVersion === "CV EN" ? "EN" : "FR",
                  fitScore: raw.fitScore || 0,
                  fitDetails: [],
                  strategy: raw.nextAction || "Réviser les preuves importées",
                  companyFacts: [],
                }
              : undefined),
          legacyEvidenceMap: raw.evidenceMap || [],
        } as Entity;
      }
      if (table === "Contacts")
        return {
          applicationId: "",
          email: "",
          linkedin: "",
          source: "",
          alumniSkema: false,
          relevance: "",
          primary: false,
          ...base,
          emailStatus:
            raw.emailStatus === "Public vérifié"
              ? "VERIFIED_PUBLIC"
              : raw.emailStatus === "Probable"
                ? "PROBABLE_PATTERN"
                : raw.emailStatus || "NOT_FOUND",
        } as Entity;
      if (table === "Interactions")
        return {
          summary: raw.subject || "Interaction importée",
          ...base,
          createdAt: String(raw.createdAt || raw.date || ""),
          classification: raw.classification || raw.aiClassification,
        } as Entity;
      if (table === "Profile") return { ...defaultProfile, ...base } as Entity;
      if (table === "Settings")
        return { ...defaultSettings, ...base } as Entity;
      return base as Entity;
    });
  return { seeds, events: rows.slice(1).filter(isEvent) };
}
export function legacyDocuments(apps: Entity[]): Entity[] {
  return apps.flatMap((app) => {
    const a = app as Entity & Record<string, unknown>;
    return [
      ["LM", a.coverLetter],
      ["Email", a.applicationEmail],
      ["LinkedIn", a.linkedinMessage],
      ["Offre", a.jobSnapshot],
    ]
      .filter(([, text]) => typeof text === "string" && text)
      .map(([type, text]) => ({
        id: `legacy-${a.id}-${type}`,
        applicationId: a.id,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        type,
        text,
        filename: `${type}_${a.company}_v1`,
        version: 1,
        usedForApplication: !!a.applicationDate,
        quality: "Version historique importée, relecture requise",
      }));
  });
}

export function legacyContacts(apps: Entity[]): Entity[] {
  return apps.flatMap((app) => {
    const row = app as Entity & {
      company: string;
      contacts?: Record<string, unknown>[];
    };
    return (Array.isArray(row.contacts) ? row.contacts : []).map((c, i) => ({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      applicationId: row.id,
      company: row.company,
      name: "",
      role: "",
      type: "Autre",
      email: "",
      linkedin: "",
      source: "",
      alumniSkema: false,
      relevance: "",
      primary: false,
      ...c,
      id: String(c.id || `legacy-contact-${row.id}-${i}`),
      emailStatus:
        c.emailStatus === "Public vérifié"
          ? "VERIFIED_PUBLIC"
          : c.emailStatus === "Probable"
            ? "PROBABLE_PATTERN"
            : "NOT_FOUND",
    }));
  });
}

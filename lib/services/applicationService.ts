import { z } from "zod";
import { createHash } from "node:crypto";
import type {
  Application,
  Contact,
  Document,
  Profile,
  Interaction,
  Source,
} from "../types";
import { defaultProfile } from "../types";
import { SheetsRepository, entity } from "../repositories/store";
import { ai } from "./ai";
import { rankOccurrences } from "./occurrences";
import { research } from "./researchService";
import { history } from "./gmailService";
import { analysisSchema, contactSchema, deliverablesSchema } from "./schemas";
import analysisPrompt from "../prompts/job-analysis";
import matchPrompt from "../prompts/profile-matching";
import contactPrompt from "../prompts/contact-analysis";
import letterPrompt from "../prompts/cover-letter";
import emailPrompt from "../prompts/application-email";
import linkedinPrompt from "../prompts/linkedin";
export async function profileFor(token: string) {
  return (
    (await new SheetsRepository<Profile>(token, "Profile").findById(
      "profile",
    )) || defaultProfile
  );
}
export function validateEvidence(
  matches: { type: string; evidenceIds: string[] }[],
  profile: Profile,
) {
  const ids = new Set(profile.evidence.map((e) => e.id));
  for (const m of matches) {
    if (m.evidenceIds.some((id) => !ids.has(id)))
      throw new Error("Contrôle bloquant : preuve inconnue");
    const evidence = profile.evidence.filter((e) =>
      m.evidenceIds.includes(e.id),
    );
    if (m.type === "DIRECT" && !evidence.some((e) => e.type === "DIRECT"))
      throw new Error(
        "Contrôle bloquant : une preuve académique ou transférable ne devient pas directe",
      );
    if (
      m.type === "TRANSFERABLE" &&
      evidence.every(
        (e) => e.type === "ACADEMIC" || e.type === "NOT_DEMONSTRATED",
      )
    )
      throw new Error(
        "Contrôle bloquant : connaissance académique présentée comme expérience",
      );
    if (m.type !== "NOT_DEMONSTRATED" && !m.evidenceIds.length)
      throw new Error("Contrôle bloquant : affirmation sans preuve");
  }
}
export async function prepare(token: string, id: string, force = false) {
  const repo = new SheetsRepository<Application>(token, "Applications");
  const app = await repo.findById(id);
  if (!app) throw new Error("Offre introuvable");
  const profile = await profileFor(token);
  if (!profile.evidence.length)
    throw new Error("Importez et validez d’abord votre profil dans Profil.");
  if (!app.description) throw new Error("Ajoutez le texte de l’offre.");
  const existing = await new SheetsRepository<Document>(
    token,
    "Documents",
  ).findAll();
  if (
    app.preparedAt &&
    app.preparedAt >= profile.updatedAt &&
    Date.now() - new Date(app.preparedAt).getTime() < 3600000 &&
    !force &&
    existing.some((d) => d.applicationId === id && d.type === "LM")
  )
    return { cached: true, warnings: [] };
  const warnings: string[] = [];
  let fresh: Source[] = [];
  if (process.env.TAVILY_API_KEY) {
    try {
      fresh = await research(app);
    } catch {
      warnings.push(
        "Recherche indisponible : analyse limitée aux sources conservées.",
      );
    }
  } else
    warnings.push(
      "Recherche non configurée : analyse limitée à l’offre et aux sources conservées.",
    );
  const sources = rankOccurrences([...app.sources, ...fresh], app);
  // Archive each full source independently; never discard evidence to fit an application cell.
  const sr = new SheetsRepository<
    Source & {
      id: string;
      createdAt: string;
      updatedAt: string;
      applicationId: string;
    }
  >(token, "JobSources");
  for (const source of fresh)
    await sr.create({
      ...entity(
        createHash("sha256")
          .update(id + source.url + source.checkedAt)
          .digest("hex"),
      ),
      ...source,
      applicationId: id,
    });
  const gmail = await history(token, app);
  const context = {
    CANDIDATE_PROFILE: profile,
    JOB: app,
    COMPANY_RESEARCH: sources,
    GMAIL_HISTORY: gmail.mails,
    WRITING_RULES: profile.writingRules,
  };
  const analysis = await ai(
    analysisPrompt + " " + matchPrompt,
    context,
    analysisSchema,
  );
  validateEvidence(analysis.matches, profile);
  const sourceUrls = new Set(sources.map((s) => s.url));
  if (analysis.companyFacts.some((f) => !sourceUrls.has(f.sourceUrl)))
    throw new Error("Contrôle bloquant : source entreprise inconnue");
  const proposed = await ai(
    contactPrompt,
    { job: app, sources },
    contactSchema,
    { fast: true, maxOutputTokens: 2400 },
  );
  const cr = new SheetsRepository<Contact>(token, "Contacts");
  let n = 0;
  for (const c of proposed.contacts) {
    const source = sources.find((s) => s.url === c.source);
    if (
      !source ||
      !c.name.trim() ||
      !c.role.trim() ||
      !source.content.toLowerCase().includes(c.name.toLowerCase()) ||
      !source.content.toLowerCase().includes(c.role.toLowerCase())
    )
      continue;
    const email = c.email && source.content.includes(c.email) ? c.email : "";
    const linkedin =
      c.linkedin &&
      sources.some(
        (s) => s.url === c.linkedin || s.content.includes(c.linkedin),
      )
        ? c.linkedin
        : "";
    const cid = createHash("sha256")
      .update(app.company.toLowerCase() + "|" + c.name.toLowerCase())
      .digest("hex")
      .slice(0, 24);
    await cr.create({
      ...entity(cid),
      ...c,
      alumniSkema: c.alumniSkema && /skema/i.test(source.content),
      linkedin,
      email,
      emailStatus: email ? "VERIFIED_PUBLIC" : "NOT_FOUND",
      company: app.company,
      applicationId: id,
      primary: n++ === 0,
    });
  }
  const contacts = (await cr.findAll()).filter(
    (c) => c.company === app.company,
  );
  let draft = await ai(
    letterPrompt + " " + emailPrompt + " " + linkedinPrompt,
    { ...context, EVIDENCE_MAP: analysis, CONTACTS: contacts },
    deliverablesSchema,
  );
  const qualitySchema = z.object({
    passed: z.boolean(),
    issues: z.array(z.string()),
  });
  let passed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const claim of draft.claims) {
      if (
        claim.evidenceIds.some(
          (id) => !profile.evidence.some((e) => e.id === id),
        ) ||
        claim.sourceUrls.some((url) => !sourceUrls.has(url)) ||
        (!claim.evidenceIds.length && !claim.sourceUrls.length)
      )
        throw new Error("Contrôle bloquant : affirmation non sourcée");
    }
    const quality = await ai(
      "Audite CHAQUE affirmation factuelle des textes contre les preuves et extraits sources. Vérifie que les citations soutiennent réellement les affirmations, langue, noms, dates, outils, survente, disponibilité, CTA. Une affirmation inventée ou exagérée => passed false. Les claims fournis ne dispensent pas de vérifier tout le texte.",
      { ...context, analysis, draft },
      qualitySchema,
    );
    const words = draft.coverLetter.trim().split(/\s+/).length;
    const lengths =
      words >= 400 &&
      words <= 480 &&
      draft.linkedinConnection.length <= 200 &&
      draft.linkedinMessage.length <= 600 &&
      draft.inmail.length <= 1000;
    if (quality.passed && lengths) {
      passed = true;
      break;
    }
    if (attempt === 0)
      draft = await ai(
        "Corrige uniquement les problèmes suivants, sans ajouter aucun fait: " +
          quality.issues.join("; ") +
          " Respecte LM 400-480 mots et limites LinkedIn.",
        { ...context, analysis, draft },
        deliverablesSchema,
      );
  }
  if (!passed)
    throw new Error(
      "La rédaction n’a pas passé le contrôle factuel ou de longueur. Aucun livrable marqué prêt. Réessayez.",
    );
  const docs = new SheetsRepository<Document>(token, "Documents");
  const list = [
    ["LM", draft.coverLetter],
    ["Email", draft.emailSubject + "\n\n" + draft.email],
    [
      "LinkedIn",
      draft.linkedinConnection +
        "\n\n" +
        draft.linkedinMessage +
        "\n\n" +
        draft.inmail,
    ],
  ];
  for (const [type, text] of list) {
    const version =
      1 +
      Math.max(
        0,
        ...existing
          .filter((d) => d.applicationId === id && d.type === type)
          .map((d) => d.version),
      );
    await docs.create({
      ...entity(),
      applicationId: id,
      type,
      text,
      filename: `${type}_${app.company}_${app.jobTitle}_v${version}`,
      version,
      usedForApplication: false,
      quality: "Contrôle IA passé ; relecture humaine requise",
    });
  }
  await repo.update(id, {
    analysis,
    sources: sources.map((s) => ({ ...s, content: s.content.slice(0, 350) })),
    gmailHistory: gmail.mails.slice(0, 10).map((m) => ({
      ...m,
      text: m.text.slice(0, 400),
    })),
    gmailCheckedAt: new Date().toISOString(),
    preparedAt: new Date().toISOString(),
    status:
      ["Inbox", "À analyser", "À préparer", "Prête à envoyer"].includes(
        app.status,
      ) && !app.applicationDate
        ? "Prête à envoyer"
        : app.status,
    nextAction: app.applicationDate
      ? app.nextAction
      : "Relire les documents et déposer sur le canal officiel",
  });
  await new SheetsRepository<Interaction>(token, "Interactions").create({
    ...entity(),
    applicationId: id,
    type: "Préparation",
    summary:
      "Analyse, recherche, preuves, contacts et historique Gmail vérifiés. Documents prêts pour relecture.",
  });
  return {
    cached: false,
    warnings: [
      ...warnings,
      ...(gmail.truncated
        ? ["Historique limité aux 25 messages les plus récents."]
        : []),
    ],
  };
}
export async function saveResearch(
  token: string,
  id: string,
  sources: Source[],
) {
  return new SheetsRepository<Application>(token, "Applications").update(id, {
    sources,
  });
}

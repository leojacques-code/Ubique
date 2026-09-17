import { createHash } from "node:crypto";
import { z } from "zod";
import { search, extract } from "./researchService";
import { ai } from "./ai";
import { jobSchema } from "./schemas";
import { SheetsRepository, entity } from "../repositories/store";
import { normalizeJobUrl } from "./occurrences";
import { fingerprint, safeUrl } from "../security";
import {
  defaultSettings,
  type Settings,
  type Application,
  type Document,
  type SyncLog,
} from "../types";
export async function addJob(
  token: string,
  input: {
    url?: string;
    description?: string;
    company?: string;
    jobTitle?: string;
    isWatch?: boolean;
  },
) {
  if (input.url && !safeUrl(input.url))
    throw new Error("URL publique HTTPS attendue");
  const repo = new SheetsRepository<Application>(token, "Applications");
  const all = await repo.findAll();
  const exactUrl = input.url && normalizeJobUrl(input.url);
  const exact =
    exactUrl &&
    all.find((a) =>
      [a.officialUrl, ...a.sources.map((s) => s.url)].some(
        (url) => normalizeJobUrl(url) === exactUrl,
      ),
    );
  if (exact) return exact;
  const description = (
    input.description || (await extract(input.url || ""))
  ).slice(0, 18000);
  const info = process.env.OPENAI_API_KEY
    ? await ai(
        "Extrais les champs de cette offre sans inventer. Pour les dates inconnues, chaîne vide. Le contrat CDI et un stage sont DISTINCTS, jamais fusionnés.",
        { text: description, url: input.url },
        jobSchema,
        { fast: true, maxOutputTokens: 1500 },
      )
    : {
        company: input.company || "",
        jobTitle: input.jobTitle || "",
        location: "",
        contractType: "",
        startDate: "",
        reference: "",
        vertical: "À analyser",
        publicationDate: "",
        deadline: "",
        language: "FR",
      };
  if (!info.company || !info.jobTitle)
    throw new Error("Sans OpenAI, renseignez au moins la société et le poste.");
  const old = all.find((a) => fingerprint(a) === fingerprint(info));
  const source = {
    url: input.url || "",
    title: info.jobTitle,
    content: description.slice(0, 2000),
    checkedAt: new Date().toISOString(),
  };
  if (old) {
    if (input.url && !old.sources.some((s) => s.url === input.url))
      await repo.update(old.id, { sources: [...old.sources, source] });
    return old;
  }
  const id = createHash("sha256")
    .update(fingerprint(info))
    .digest("hex")
    .slice(0, 24);
  const app: Application = {
    ...entity(id),
    ...info,
    company: input.company || info.company,
    jobTitle: input.jobTitle || info.jobTitle,
    priority: "B",
    careerPriority: "À évaluer",
    status: "À analyser",
    stage: "Candidature",
    officialUrl: input.url || "",
    description,
    nextAction: "Analyser et vérifier la source officielle",
    nextActionDate: "",
    applicationDate: "",
    lastInteraction: "",
    notes: "",
    isWatch: input.isWatch || false,
    ignored: false,
    sources: [source],
  };
  await repo.create(app);
  await new SheetsRepository<Document>(token, "Documents").create({
    ...entity("snapshot-" + id),
    applicationId: id,
    type: "Offre",
    filename: "Offre_" + app.company,
    text: description,
    version: 1,
    usedForApplication: false,
    quality: "Texte importé, source à vérifier",
  });
  return app;
}
export async function watch(token: string) {
  const lr = new SheetsRepository<SyncLog>(token, "SyncLog");
  const log = {
    ...entity(),
    type: "Veille",
    status: "En cours",
    itemsProcessed: 0,
    errors: [] as string[],
  };
  await lr.create(log);
  try {
    const settings =
      (await new SheetsRepository<Settings>(token, "Settings").findById(
        "settings",
      )) || defaultSettings;
    const repo = new SheetsRepository<Application>(token, "Applications");
    const existing = await repo.findAll();
    for (const q of settings.watchQueries.slice(0, 4)) {
      const sources = await search(q);
      const qualified = await ai(
        "Sélectionne au maximum 2 vraies offres individuelles junior finance dans les résultats, pas les pages agrégées. Paris prioritaire, janvier 2027. Un intitulé senior exclu reste écarté de cette sélection, jamais supprimé d’une base existante. Ne crée aucun contenu de poste absent des sources. Retourne uniquement URLs présentes.",
        { sources, preferences: settings },
        z.object({ urls: z.array(z.string()).max(2) }),
        { fast: true, maxOutputTokens: 1000 },
      );
      for (const url of qualified.urls) {
        if (
          !sources.some((s) => s.url === url) ||
          existing.some((a) => a.sources.some((s) => s.url === url))
        )
          continue;
        try {
          const app = await addJob(token, { url, isWatch: true });
          existing.push(app);
          log.itemsProcessed++;
        } catch (e) {
          log.errors.push(e instanceof Error ? e.message : "Import impossible");
        }
      }
    }
    await lr.update(log.id, {
      status: log.errors.length ? "Partiel" : "Terminé",
      itemsProcessed: log.itemsProcessed,
      errors: log.errors,
    });
    return log;
  } catch (e) {
    await lr.update(log.id, {
      status: "Erreur",
      errors: [e instanceof Error ? e.message : "Recherche indisponible"],
    });
    throw e;
  }
}

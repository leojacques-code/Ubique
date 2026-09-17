export const profileEvidenceCategories = [
  "Expérience",
  "Formation",
  "Compétence",
  "Langue",
  "Projet",
  "Intérêt",
] as const;

export type ProfileEvidenceCategory = (typeof profileEvidenceCategories)[number];

export type ExtractedProfileEvidence = {
  category: ProfileEvidenceCategory;
  fact: string;
  type: "DIRECT" | "ACADEMIC";
};

function normalizedKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compactProfileEvidence(
  evidence: ExtractedProfileEvidence[],
  limit = 40,
) {
  const seen = new Set<string>();
  const result: ExtractedProfileEvidence[] = [];

  for (const item of evidence) {
    const fact = item.fact.replace(/\s+/g, " ").trim();
    if (!fact) continue;
    const key = `${item.category}:${normalizedKey(fact)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      category: item.category,
      fact,
      type: item.type === "ACADEMIC" ? "ACADEMIC" : "DIRECT",
    });
    if (result.length >= limit) break;
  }

  return result;
}

export const compactCvInstruction = `
Extrais le CV sous forme d'un profil de preuves COMPACT, fidèle et directement relisible.

Objectif : environ 20 à 35 preuves utiles, jamais plus de 40. Ne crée JAMAIS une preuve par phrase, par ligne ou par micro-mission.

Règles de regroupement :
- Pour chaque expérience professionnelle : 1 preuve d'identité (poste, entreprise, lieu, dates), puis 3 à 6 preuves maximum regroupant les responsabilités, réalisations, outils et chiffres par thème cohérent.
- Une preuve peut réunir plusieurs micro-missions proches si elles appartiennent au même thème. Elle doit rester concise mais autonome.
- Commence chaque preuve d'expérience par un ancrage explicite du type « Entreprise — Poste | ... » afin qu'elle reste compréhensible hors contexte.
- Pour chaque formation : 1 preuve de cursus (établissement, diplôme, dates), puis 1 à 3 preuves académiques réellement utiles maximum. Un cours ou projet académique reste ACADEMIC.
- Regroupe les outils et compétences proches par famille au lieu d'une ligne par outil.
- Pour les langues : une preuve par langue avec uniquement le niveau ou score explicitement présent dans le CV.
- Regroupe les intérêts proches ; ne crée pas une ligne par mot.
- Conserve toutes les expériences du CV et tous les chiffres, montants, pourcentages, scores, dates et noms EXACTEMENT tels qu'ils apparaissent. Ne réinterprète aucun chiffre.
- N'invente rien, ne complète aucune information manquante et ne transforme jamais M&A en Private Equity.
- Un classement, une réputation d'école ou une connaissance générale extérieure au CV n'est pas une preuve.

Classification du profil source :
- DIRECT = fait explicitement attesté par le CV (expérience, compétence pratiquée, outil, langue, projet, intérêt).
- ACADEMIC = cursus, cours, projet ou connaissance strictement académique.
- N'utilise pas TRANSFERABLE ni NOT_DEMONSTRATED pendant l'extraction du CV : ces deux catégories sont déterminées plus tard lors du matching avec une offre.
`;

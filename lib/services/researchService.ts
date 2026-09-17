import type { Source, Application } from "../types";
import { publicPage } from "../public-url";
import { rankOccurrences } from "./occurrences";
import { safeUrl } from "../security";
export async function search(query: string): Promise<Source[]> {
  if (!process.env.TAVILY_API_KEY)
    throw new Error("Recherche indisponible : configurez TAVILY_API_KEY.");
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: query.trim().slice(0, 800),
      max_results: 5,
      search_depth: "advanced",
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Recherche indisponible (${r.status})`);
  const data = await r.json();
  return (data.results || [])
    .filter((s: { url: string }) => safeUrl(s.url))
    .map((s: { url: string; title: string; content: string }) => ({
      url: s.url,
      title: s.title,
      content: s.content.slice(0, 5000),
      checkedAt: new Date().toISOString(),
    }));
}
export async function extract(url: string) {
  if (!safeUrl(url)) throw new Error("Une URL HTTPS valide est requise");
  if (!process.env.TAVILY_API_KEY) return publicPage(url);
  const r = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, urls: [url] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok)
    throw new Error("Extraction indisponible : collez le texte de l’offre.");
  const data = await r.json();
  const text = data.results?.[0]?.raw_content;
  if (!text)
    throw new Error(
      "Cette page est inaccessible : collez le texte de l’offre.",
    );
  return String(text).slice(0, 18000);
}
export async function research(app: Application) {
  const queries = [
    `${app.company} official investment strategy transactions team ${app.vertical}`,
    ...[
      "careers ATS",
      "LinkedIn jobs",
      "Welcome to the Jungle JobTeaser",
      "eFinancialCareers Indeed Glassdoor",
    ].map(
      (platform) =>
        `"${app.company}" "${app.jobTitle}" ${app.reference} ${platform}`,
    ),
    `"${app.company}" recruitment talent analyst associate SKEMA team`,
  ];
  const results = await Promise.all(queries.map(search));
  return rankOccurrences(results.flat(), app).slice(0, 24);
}

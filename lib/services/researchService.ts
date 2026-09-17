import type { Source, Application } from "../types";
import { safeUrl } from "../security";
export async function search(query: string): Promise<Source[]> {
  if (!process.env.TAVILY_API_KEY)
    throw new Error("Recherche indisponible : configurez TAVILY_API_KEY.");
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
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
  if (!process.env.TAVILY_API_KEY)
    throw new Error(
      "Collez le texte de l’offre, ou configurez la recherche pour extraire cette URL.",
    );
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
  return String(text).slice(0, 14000);
}
export async function research(app: Application) {
  const queries = [
    `${app.company} official investment strategy transactions team ${app.vertical}`,
    `"${app.company}" "${app.jobTitle}" ${app.reference} careers LinkedIn WTTJ JobTeaser eFinancialCareers`,
    `"${app.company}" recruitment investment team analyst associate SKEMA`,
  ];
  const results = await Promise.all(queries.map(search));
  return [...new Map(results.flat().map((s) => [s.url, s])).values()].slice(
    0,
    12,
  );
}

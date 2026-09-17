import type { Application, Source } from "../types";
export function normalizeJobUrl(value: string) {
  try {
    const u = new URL(value);
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|trk$|trackingId$|referrer$|source$)/i.test(k))
        u.searchParams.delete(k);
    u.searchParams.sort();
    return u.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}
export function isAts(url: string) {
  try {
    return /(^|\.)(myworkdayjobs\.com|greenhouse\.io|lever\.co|smartrecruiters\.com|icims\.com|successfactors\.com|teamtailor\.com|jobs\.ashbyhq\.com)$/.test(
      new URL(url).hostname,
    );
  } catch {
    return false;
  }
}
export function rankOccurrences(
  sources: Source[],
  app: Pick<Application, "company" | "jobTitle" | "reference">,
) {
  const matches = (s: Source) => {
    const text = (s.title + " " + s.content).toLowerCase();
    return (
      text.includes(app.company.toLowerCase()) &&
      (app.reference
        ? text.includes(app.reference.toLowerCase())
        : text.includes(app.jobTitle.toLowerCase()))
    );
  };
  const unique = [
    ...new Map(
      sources.map((s) => [normalizeJobUrl(s.url) || s.url, s]),
    ).values(),
  ];
  return unique.sort(
    (a, b) =>
      Number(!!b.isOfficial || (isAts(b.url) && matches(b))) -
      Number(!!a.isOfficial || (isAts(a.url) && matches(a))),
  );
}

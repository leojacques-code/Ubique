import { google } from "../google";
import { gmailTerm } from "../security";
import type { Application, Mail } from "../types";
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function body(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data)
    return Buffer.from(p.body.data, "base64url").toString();
  return (p.parts || []).map(body).join("\n");
}
export async function searchMail(
  token: string,
  query: string,
  max = 30,
  pageToken = "",
) {
  const data = await google<{
    messages?: { id: string }[];
    nextPageToken?: string;
  }>(
    token,
    "gmail/v1/users/me/messages?maxResults=" +
      max +
      "&q=" +
      encodeURIComponent(query) +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
  );
  const mails: Mail[] = [];
  for (const m of data.messages || []) {
    const data = await google<{
      id: string;
      threadId: string;
      labelIds?: string[];
      internalDate: string;
      snippet: string;
      payload: Part & { headers: { name: string; value: string }[] };
    }>(token, `gmail/v1/users/me/messages/${m.id}?format=full`);
    const header = (name: string) =>
      data.payload.headers.find((h) => h.name.toLowerCase() === name)?.value ||
      "";
    mails.push({
      id: data.id,
      threadId: data.threadId,
      subject: header("subject"),
      from: header("from"),
      date: new Date(Number(data.internalDate)).toISOString(),
      text: (body(data.payload) || data.snippet).slice(0, 5000),
      labels: data.labelIds || [],
    });
  }
  return {
    mails,
    truncated: !!data.nextPageToken,
    nextPageToken: data.nextPageToken || "",
  };
}
export async function history(token: string, app: Application) {
  const q = [
    "-in:spam",
    "-in:trash",
    "{" +
      [gmailTerm(app.company), app.reference ? gmailTerm(app.reference) : ""]
        .filter(Boolean)
        .join(" ") +
      "}",
  ].join(" ");
  return searchMail(token, q, 25);
}
export async function draft(
  token: string,
  to: string,
  subject: string,
  text: string,
  attachments: { name: string; bytes: Uint8Array; mime: string }[] = [],
) {
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to) || /[\r\n]/.test(subject))
    throw new Error("Destinataire ou objet invalide");
  const boundary = "crm_" + crypto.randomUUID();
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const parts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
  ];
  for (const a of attachments) {
    const filename = a.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mime}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(a.bytes).toString("base64"),
    );
  }
  parts.push(`--${boundary}--`);
  return google<{ id: string; message: { id: string; threadId: string } }>(
    token,
    "gmail/v1/users/me/drafts",
    {
      method: "POST",
      body: JSON.stringify({
        message: { raw: Buffer.from(parts.join("\r\n")).toString("base64url") },
      }),
    },
  );
}
export const labelNames = [
  "Candidatures/À traiter",
  "Candidatures/Envoyée",
  "Candidatures/Relance",
  "Candidatures/En process",
  "Candidatures/Offre",
  "Candidatures/Refus",
  "Candidatures/Alertes offres",
];
export async function syncLabel(
  token: string,
  threadId: string,
  status: string,
) {
  const labels = await google<{ labels: { id: string; name: string }[] }>(
    token,
    "gmail/v1/users/me/labels",
  );
  const ids: string[] = [];
  for (const name of labelNames) {
    let label = labels.labels.find((l) => l.name === name);
    if (!label)
      label = await google(token, "gmail/v1/users/me/labels", {
        method: "POST",
        body: JSON.stringify({
          name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        }),
      });
    ids.push(label!.id);
  }
  const name = labelNames.includes("Candidatures/" + status)
    ? "Candidatures/" + status
    : "Candidatures/À traiter";
  const id = ids[labelNames.indexOf(name)];
  await google(token, `gmail/v1/users/me/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [id],
      removeLabelIds: ids.filter((v) => v !== id),
    }),
  });
}

import { z } from "zod";
import { accessToken, checkOrigin, AuthError } from "@/lib/auth";
import { SheetsRepository, entity, initialize } from "@/lib/repositories/store";
import {
  statuses,
  stages,
  type Application,
  type Contact,
  type Document,
  type Interaction,
  type Profile,
  type Settings,
} from "@/lib/types";
import { prepare, profileFor } from "@/lib/services/applicationService";
import { addJob, watch } from "@/lib/services/jobService";
import { history, draft, syncLabel } from "@/lib/services/gmailService";
import { gmailSync } from "@/lib/services/gmailSyncService";
import {
  exportDocument,
  downloadDrive,
  renderPdf,
} from "@/lib/services/documentService";
import { ai } from "@/lib/services/ai";
import { businessDate, safeUrl } from "@/lib/security";
export const maxDuration = 300;
const text = z.string().max(18000);
const contact = z.object({
  applicationId: z.string(),
  company: z.string().min(1).max(200),
  name: z.string().min(1).max(150),
  role: z.string().max(200),
  type: z.string().max(100),
  email: z.string().max(200),
  emailStatus: z.enum(["VERIFIED_PUBLIC", "PROBABLE_PATTERN", "NOT_FOUND"]),
  linkedin: z.string().max(1000),
  source: z.string().max(1000),
  alumniSkema: z.boolean(),
  relevance: z.string().max(2000),
  primary: z.boolean(),
});
const evidence = z.object({
  id: z.string(),
  category: z.string(),
  fact: z.string().max(3000),
  source: z.string(),
  type: z.enum(["DIRECT", "TRANSFERABLE", "ACADEMIC", "NOT_DEMONSTRATED"]),
});
const profile = z.object({
  name: z.string().max(100),
  availability: z.string().max(30),
  location: z.string().max(100),
  convention: z.enum(["UNKNOWN", "AVAILABLE", "NOT_AVAILABLE"]),
  evidence: z.array(evidence).max(150),
  writingRules: text,
  instructions: text,
});
const settings = z.object({
  preferredLocations: z.string(),
  keywords: z.string(),
  negativeKeywords: z.string(),
  excludedCompanies: z.string(),
  gmailLabels: z.boolean(),
  autoStatus: z.boolean(),
  threshold: z.number().min(0.85).max(1),
  watchQueries: z.array(z.string().max(300)).max(10),
});
const patch = z.object({
  status: z.enum(statuses).optional(),
  stage: z.enum(stages).optional(),
  priority: z.enum(["A", "B", "C"]).optional(),
  careerPriority: z.string().max(300).optional(),
  nextAction: z.string().max(600).optional(),
  nextActionDate: z.string().max(30).optional(),
  notes: text.optional(),
  officialUrl: z.string().max(2000).optional(),
  description: text.optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  isWatch: z.boolean().optional(),
  ignored: z.boolean().optional(),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = await accessToken();
    if (Number(request.headers.get("content-length")) > 150000)
      throw new Error("Requête trop volumineuse");
    const body = await request.json();
    const action = z.string().parse(body.action);
    const id = typeof body.id === "string" ? body.id : "";
    const ar = new SheetsRepository<Application>(
      token,
      "Applications",
      process.env.GOOGLE_SPREADSHEET_ID || "setup",
    );
    const dr = new SheetsRepository<Document>(
      token,
      "Documents",
      process.env.GOOGLE_SPREADSHEET_ID || "setup",
    );
    const ir = new SheetsRepository<Interaction>(
      token,
      "Interactions",
      process.env.GOOGLE_SPREADSHEET_ID || "setup",
    );
    if (action === "initialize") return Response.json(await initialize(token));
    if (action === "add") {
      return Response.json(
        await addJob(
          token,
          z
            .object({
              url: z.string().max(2000).optional(),
              description: text.optional(),
            })
            .parse(body),
        ),
      );
    }
    if (action === "update") {
      const values = patch.parse(body.patch);
      if (values.officialUrl && !safeUrl(values.officialUrl))
        throw new Error("URL HTTPS attendue");
      const app = await ar.findById(id);
      if (!app) throw new Error("Offre introuvable");
      const result = await ar.update(id, {
        ...values,
        ...(values.description ? { preparedAt: "" } : {}),
      });
      await ir.create({
        ...entity(),
        applicationId: id,
        type: "Modification",
        summary: values.status
          ? `Statut : ${app.status} → ${values.status}`
          : "Dossier mis à jour",
        oldStatus: app.status,
        newStatus: result.status,
      });
      if (values.status) {
        const setting = await new SheetsRepository<Settings>(
          token,
          "Settings",
        ).findById("settings");
        if (setting?.gmailLabels) {
          for (const thread of [
            ...new Set((app.gmailHistory || []).map((m) => m.threadId)),
          ])
            await syncLabel(token, thread, values.status);
        }
      }
      return Response.json(result);
    }
    if (action === "prepare")
      return Response.json(await prepare(token, id, !!body.force));
    if (action === "history") {
      const app = await ar.findById(id);
      if (!app) throw new Error("Offre introuvable");
      const result = await history(token, app);
      await ar.update(id, {
        gmailHistory: result.mails.slice(0, 10).map((m) => ({
          ...m,
          text: m.text.slice(0, 400),
        })),
        gmailCheckedAt: new Date().toISOString(),
      });
      return Response.json(result);
    }
    if (action === "sent") {
      const app = await ar.findById(id);
      if (!app) throw new Error("Offre introuvable");
      if (app.applicationDate) return Response.json(app);
      const selected = z.array(z.string()).parse(body.documentIds);
      const docs = (await dr.findAll()).filter((d) => selected.includes(d.id));
      if (
        docs.length !== selected.length ||
        docs.some((d) => d.applicationId && d.applicationId !== id)
      )
        throw new Error("Versions de documents invalides");
      const date = new Date().toISOString();
      await ar.update(id, {
        status: "Envoyée",
        applicationDate: date,
        cvVersion: docs.find((d) => d.type === "CV")?.filename,
        nextAction: "Vérifier une relance selon le délai annoncé",
        nextActionDate: businessDate(date),
      });
      for (const d of docs) await dr.update(d.id, { usedForApplication: true });
      await ir.create({
        ...entity("sent-" + id),
        applicationId: id,
        type: "Candidature déclarée",
        summary:
          "Dépôt confirmé manuellement par le candidat. Versions utilisées : " +
          docs.map((d) => d.filename).join(", "),
      });
      return Response.json({ ok: true });
    }
    if (action === "draft") {
      const app = await ar.findById(id);
      if (!app) throw new Error("Offre introuvable");
      const doc = await dr.findById(z.string().parse(body.documentId));
      if (
        !doc ||
        doc.applicationId !== id ||
        !["Email", "Relance", "Remerciement"].includes(doc.type)
      )
        throw new Error("Email introuvable");
      const contactRow = await new SheetsRepository<Contact>(
        token,
        "Contacts",
      ).findById(z.string().parse(body.contactId));
      if (
        !contactRow ||
        contactRow.company !== app.company ||
        contactRow.emailStatus !== "VERIFIED_PUBLIC"
      )
        throw new Error("Sélectionnez un contact à adresse publique vérifiée.");
      const ids = z
        .array(z.string())
        .max(3)
        .parse(body.attachmentIds || []);
      const all = await dr.findAll();
      const attachments = [];
      for (const attachmentId of ids) {
        const d = all.find((d) => d.id === attachmentId);
        if (!d || (d.applicationId && d.applicationId !== id))
          throw new Error("Pièce jointe invalide");
        if (d.type === "CV") {
          if (!d.driveFileId) throw new Error("CV absent de Drive");
          attachments.push({
            name: d.filename,
            bytes: await downloadDrive(token, d.driveFileId),
            mime:
              d.mimeType ||
              (d.filename.endsWith(".docx")
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/pdf"),
          });
        } else if (d.type === "LM")
          attachments.push({
            name: d.filename + ".pdf",
            bytes: await renderPdf(d.text),
            mime:
              d.mimeType ||
              (d.filename.endsWith(".docx")
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/pdf"),
          });
        else throw new Error("Seuls CV et LM peuvent être joints.");
      }
      const [subject, ...lines] = doc.text.split("\n");
      const result = await draft(
        token,
        contactRow.email,
        subject,
        lines.join("\n"),
        attachments,
      );
      await ir.create({
        ...entity(),
        applicationId: id,
        type: "Brouillon Gmail",
        summary:
          "Brouillon créé pour " + contactRow.name + ". Aucun email envoyé.",
        gmailMessageId: result.message.id,
        threadId: result.message.threadId,
      });
      return Response.json({ draftId: result.id });
    }
    if (action === "save-document") {
      const old = await dr.findById(id);
      if (!old) throw new Error("Document introuvable");
      const value = text.parse(body.text);
      const all = await dr.findAll();
      const version =
        1 +
        Math.max(
          ...all
            .filter(
              (d) =>
                d.applicationId === old.applicationId && d.type === old.type,
            )
            .map((d) => d.version),
        );
      return Response.json(
        await dr.create({
          ...entity(),
          applicationId: old.applicationId,
          type: old.type,
          filename: old.filename.replace(/_v\d+$/, "") + "_v" + version,
          text: value,
          version,
          usedForApplication: false,
          quality: "Version modifiée manuellement, à relire",
        }),
      );
    }
    if (action === "export") {
      const doc = await dr.findById(id);
      if (!doc) throw new Error("Document introuvable");
      const result = await exportDocument(
        token,
        doc,
        z.enum(["pdf", "docx"]).parse(body.format),
      );
      await dr.update(id, {
        driveFileId: result.id,
        driveUrl: result.webViewLink,
      });
      return Response.json(result);
    }
    if (action === "contact") {
      const c = contact.parse(body.contact);
      if (
        c.emailStatus === "VERIFIED_PUBLIC" &&
        (!safeUrl(c.source) || !c.email)
      )
        throw new Error("Une source publique et une adresse sont requises.");
      if (c.linkedin && !safeUrl(c.linkedin))
        throw new Error("Lien LinkedIn invalide");
      return Response.json(
        await new SheetsRepository<Contact>(token, "Contacts").create({
          ...entity(),
          ...c,
        }),
      );
    }
    if (action === "profile") {
      const p = profile.parse(body.profile);
      const r = new SheetsRepository<Profile>(token, "Profile");
      return Response.json(
        (await r.findById("profile"))
          ? await r.update("profile", p)
          : await r.create({ ...entity("profile"), ...p }),
      );
    }
    if (action === "settings") {
      const s = settings.parse(body.settings);
      const r = new SheetsRepository<Settings>(token, "Settings");
      return Response.json(
        (await r.findById("settings"))
          ? await r.update("settings", s)
          : await r.create({ ...entity("settings"), ...s }),
      );
    }
    if (action === "watch") return Response.json(await watch(token));
    if (action === "sync") return Response.json(await gmailSync(token));
    if (action === "import-mail") {
      const { searchMail } = await import("@/lib/services/gmailService");
      return Response.json(
        await searchMail(
          token,
          "newer_than:180d -in:spam -in:trash {subject:candidature subject:application subject:interview subject:entretien}",
          30,
        ),
      );
    }
    if (action === "write" || action === "assistant") {
      const app = await ar.findById(id);
      if (!app?.analysis)
        throw new Error("Préparez d’abord le dossier et ses preuves.");
      const p = await profileFor(token);
      const kind = z
        .enum([
          "Entretien",
          "Relance",
          "Remerciement",
          "Formulaire",
          "Assistant",
        ])
        .parse(body.kind || "Assistant");
      const question = z
        .string()
        .max(3000)
        .parse(body.question || "");
      const limit = z
        .number()
        .min(50)
        .max(10000)
        .parse(body.limit || 5000);
      const result = await ai(
        `Rédige ${kind}. ${kind === "Formulaire" ? "Réponds directement à la question avec preuves, sans répétition." : kind === "Entretien" ? "Société, équipe, stratégie sourcée, CV, questions techniques et comportementales, faiblesses, questions à poser." : "Sobre, bref, personnalisé. Email: objet première ligne."} Maximum ${limit} caractères.`,
        { profile: p, job: app, question },
        z.object({ text: z.string() }),
      );
      if (result.text.length > limit)
        throw new Error(
          "Réponse trop longue : réduisez la question et réessayez.",
        );
      if (action === "assistant") return Response.json(result);
      const docs = await dr.findAll();
      const version =
        1 +
        Math.max(
          0,
          ...docs
            .filter((d) => d.applicationId === id && d.type === kind)
            .map((d) => d.version),
        );
      return Response.json(
        await dr.create({
          ...entity(),
          applicationId: id,
          type: kind,
          filename: `${kind}_${app.company}_v${version}`,
          text: result.text,
          version,
          usedForApplication: false,
          quality: "Brouillon à relire",
        }),
      );
    }
    if (action === "clear-generated") {
      const docs = await dr.findAll();
      for (const d of docs.filter(
        (d) => !d.usedForApplication && d.type !== "CV" && d.type !== "Offre",
      ))
        await dr.remove(d.id);
      return Response.json({ ok: true });
    }
    throw new Error("Action inconnue");
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Champs invalides : vérifiez votre saisie."
            : e instanceof Error
              ? e.message
              : "Action impossible",
      },
      { status: e instanceof AuthError ? 401 : 400 },
    );
  }
}

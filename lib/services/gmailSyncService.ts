import { dateInTimeZone } from "../dates";
import { createHash } from "node:crypto";
import { ai } from "./ai";
import { searchMail, syncLabel } from "./gmailService";
import { mailSchema } from "./schemas";
import prompt from "../prompts/gmail-classification";
import { SheetsRepository, entity } from "../repositories/store";
import {
  defaultSettings,
  stages,
  type Application,
  type Contact,
  type Interaction,
  type Settings,
  type SyncLog,
  type Status,
  type Mail,
} from "../types";

export function proposedStatus(classification: string): Status | undefined {
  return (
    {
      APPLICATION_CONFIRMATION: "Envoyée",
      INTERVIEW_INVITE: "En process",
      CASE_STUDY: "En process",
      ONLINE_TEST: "En process",
      REJECTION: "Refus",
      OFFER: "Offre",
    } as Record<string, Status>
  )[classification];
}

export function mayAutoApply(
  app: Application,
  classification: string,
  confidence: number,
  threshold: number,
) {
  if (
    confidence < threshold ||
    ["Clôturée", "Refus", "Offre"].includes(app.status)
  )
    return false;
  if (
    classification === "APPLICATION_CONFIRMATION" &&
    app.status === "En process"
  )
    return false;
  return !!proposedStatus(classification);
}

export function hasStrongLink(app: Application, mail: Mail) {
  const text = (mail.subject + " " + mail.text).toLowerCase();
  return !!(
    app.gmailHistory?.some((m) => m.threadId === mail.threadId) ||
    (app.reference.length >= 5 && text.includes(app.reference.toLowerCase())) ||
    (app.jobTitle.length > 8 &&
      text.includes(app.jobTitle.toLowerCase()) &&
      text.includes(app.company.toLowerCase()))
  );
}

function sender(from: string) {
  const email = (from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "").trim();
  const rawName = from.includes("<") ? from.slice(0, from.indexOf("<")) : "";
  const name = rawName.replace(/^\s*["']|["']\s*$/g, "").trim();
  return { email, name: name || "Contact recrutement" };
}

export async function gmailSync(token: string) {
  const logs = new SheetsRepository<SyncLog>(token, "SyncLog");
  const started = new Date().toISOString();
  const log = {
    ...entity(),
    type: "Gmail",
    status: "En cours",
    itemsProcessed: 0,
    errors: [] as string[],
  };
  await logs.create(log);
  try {
    const ar = new SheetsRepository<Application>(token, "Applications"),
      ir = new SheetsRepository<Interaction>(token, "Interactions"),
      sr = new SheetsRepository<Settings>(token, "Settings"),
      cr = new SheetsRepository<Contact>(token, "Contacts");
    const apps = (await ar.findAll()).filter(
      (a) => !a.isWatch && !a.ignored && a.status !== "Clôturée",
    );
    const interactions = await ir.findAll();
    const settings = (await sr.findById("settings")) || defaultSettings;

    async function complete(event: Interaction) {
      const app = await ar.findById(event.applicationId);
      if (app && event.proposedPatch) {
        if (
          app.status === event.oldStatus &&
          (!app.lastInteraction ||
            app.lastInteraction <= String(event.proposedPatch.lastInteraction))
        ) {
          await ar.update(app.id, event.proposedPatch);
        } else if (app.status !== event.newStatus) {
          await ir.update(event.id, {
            requiresReview: true,
            suggestion:
              "Le dossier a changé depuis la décision IA. Vérifier avant application.",
          });
        }
      }
      if (
        settings.gmailLabels &&
        event.threadId &&
        event.newStatus !== event.oldStatus
      ) {
        try {
          await syncLabel(
            token,
            event.threadId,
            event.newStatus || "À traiter",
          );
        } catch {
          log.errors.push(
            "Label Gmail non synchronisé ; vérifier les droits et resynchroniser depuis le dossier.",
          );
        }
      }
      await ir.update(event.id, { completed: true });
    }

    for (const pending of interactions.filter(
      (i) => i.type === "Gmail" && i.completed === false,
    ))
      await complete(pending);

    const seen = new Set(
      interactions
        .filter((i) => i.completed !== false)
        .map((i) => i.gmailMessageId),
    );
    const cursor =
      settings.gmailWindowAfter ||
      (settings.lastGmailSync
        ? Math.floor(new Date(settings.lastGmailSync).getTime() / 1000) - 86400
        : Math.floor(Date.now() / 1000) - 30 * 86400);
    const companyTerms = apps
      .map((a) => '"' + a.company.replace(/["\r\n{}]/g, " ") + '"')
      .slice(0, 30)
      .join(" ");
    if (!companyTerms) {
      await logs.update(log.id, { status: "Terminé", itemsProcessed: 0 });
      return { ...log, status: "Terminé" };
    }

    const { mails, nextPageToken } = await searchMail(
      token,
      `after:${cursor} -in:spam -in:trash -in:drafts -in:sent {${companyTerms}}`,
      12,
      settings.gmailPageToken || "",
    );
    const knownContacts = await cr.findAll();

    for (const mail of mails.reverse()) {
      if (seen.has(mail.id) || mail.labels.includes("SENT")) continue;
      const mid = createHash("sha256")
        .update("gmail|" + mail.id)
        .digest("hex");
      const existing = await ir.findById(mid);
      if (existing) {
        if (existing.completed === false) await complete(existing);
        continue;
      }
      const result = await ai(
        prompt,
        {
          message: mail,
          applications: apps.map((a) => ({
            id: a.id,
            company: a.company,
            jobTitle: a.jobTitle,
            reference: a.reference,
            status: a.status,
            threadIds: a.gmailHistory?.map((m) => m.threadId),
          })),
        },
        mailSchema,
        { fast: true, maxOutputTokens: 1200 },
      );
      const matched = apps.find((a) => a.id === result.applicationId);
      const app = matched ? await ar.findById(matched.id) : undefined;
      if (!app) {
        await ir.create({
          ...entity(mid),
          applicationId: "",
          type: "Gmail non associé",
          summary: "Message examiné, aucun dossier associé avec certitude.",
          gmailMessageId: mail.id,
          completed: true,
        });
        continue;
      }

      const next = proposedStatus(result.classification);
      const strongLink = hasStrongLink(app, mail);
      const apply =
        settings.autoStatus &&
        strongLink &&
        (!app.lastInteraction || mail.date >= app.lastInteraction) &&
        mayAutoApply(
          app,
          result.classification,
          result.confidence,
          settings.threshold,
        );
      const stageIndex = stages.indexOf(
        result.detectedStage as (typeof stages)[number],
      );
      const currentIndex = stages.indexOf(app.stage as (typeof stages)[number]);
      const stage =
        stageIndex >= currentIndex && stageIndex >= 0
          ? result.detectedStage
          : app.stage;
      const gmailHistory = [
        mail,
        ...(app.gmailHistory || []).filter((m) => m.id !== mail.id),
      ].slice(0, 10);
      const proposedPatch: Partial<Application> | undefined = apply
        ? {
            status: next!,
            stage,
            applicationDate: app.applicationDate || mail.date,
            lastInteraction: mail.date,
            nextAction: result.suggestedAction,
            nextActionDate: dateInTimeZone(new Date(started)),
            gmailHistory,
            gmailCheckedAt: started,
          }
        : undefined;
      const event: Interaction = {
        ...entity(mid),
        applicationId: app.id,
        type: "Gmail",
        summary: mail.subject,
        gmailMessageId: mail.id,
        threadId: mail.threadId,
        classification: result.classification,
        confidence: result.confidence,
        oldStatus: app.status,
        newStatus: apply ? next : app.status,
        requiresReview: !apply,
        suggestion: result.suggestedAction,
        completed: false,
        proposedPatch,
      };
      await ir.create(event);
      if (!apply) {
        await ar.update(app.id, {
          gmailHistory,
          gmailCheckedAt: started,
          lastInteraction: mail.date,
        });
      }
      await complete(event);

      const parsedSender = sender(mail.from);
      if (
        parsedSender.email &&
        strongLink &&
        !knownContacts.some((c) => c.email.toLowerCase() === parsedSender.email.toLowerCase())
      ) {
        const contact = await cr.create({
          ...entity(),
          applicationId: app.id,
          company: app.company,
          name: parsedSender.name,
          role: "Recrutement / interlocuteur",
          type: "Recruiter",
          email: parsedSender.email,
          emailStatus: "VERIFIED_PUBLIC",
          linkedin: "",
          source: `Gmail · ${mail.subject}`,
          alumniSkema: false,
          relevance: "Interlocuteur détecté dans un échange Gmail associé à la candidature",
          primary: false,
        });
        knownContacts.push(contact);
      }
      log.itemsProcessed++;
    }

    const checkpoint = {
      ...settings,
      gmailPageToken: nextPageToken,
      gmailWindowAfter: nextPageToken ? cursor : 0,
      gmailWindowStarted: nextPageToken
        ? settings.gmailWindowStarted || started
        : "",
      lastGmailSync: nextPageToken
        ? settings.lastGmailSync
        : settings.gmailWindowStarted || started,
    };
    if (await sr.findById("settings")) await sr.update("settings", checkpoint);
    else await sr.create(checkpoint);
    if (nextPageToken)
      log.errors.push(
        "Lot de 12 messages traité. La prochaine synchronisation reprendra la page suivante.",
      );
    const status = log.errors.length ? "Partiel" : "Terminé";
    await logs.update(log.id, {
      status,
      itemsProcessed: log.itemsProcessed,
      errors: log.errors,
    });
    return { ...log, status };
  } catch (e) {
    await logs.update(log.id, {
      status: "Erreur",
      errors: [e instanceof Error ? e.message : "Erreur externe"],
    });
    throw e;
  }
}

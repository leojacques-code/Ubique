import { createHash } from "node:crypto";
import { z } from "zod";
import { ai } from "./ai";
import { draft } from "./gmailService";
import {
  downloadDrive,
  exportDocument,
  renderPdf,
} from "./documentService";
import { SheetsRepository, entity } from "../repositories/store";
import {
  defaultProfile,
  type Application,
  type Contact,
  type Document,
  type Interaction,
  type Mail,
  type Profile,
} from "../types";

const resultSchema = z.object({
  company: z.string().min(1).max(200),
  jobTitle: z.string().min(1).max(240),
  location: z.string().max(160),
  language: z.string().max(12),
  recipientName: z.string().max(160),
  recipientEmail: z.string().max(220),
  summary: z.string().max(1600),
  coverLetter: z.string().min(200).max(6500),
  emailSubject: z.string().min(3).max(200),
  emailBody: z.string().min(20).max(3200),
});

const instruction = `
Tu prépares UNE candidature à partir de deux seules sources de vérité : le texte exact de l'offre et le CV fourni.

But : produire directement les éléments nécessaires à une candidature, sans scoring, sans analyse longue et sans inventer.

Règles absolues :
- N'invente aucun diplôme, employeur, mission, chiffre, outil, niveau de langue, disponibilité ou expérience.
- M&A n'est jamais transformé en Private Equity.
- Une connaissance académique n'est jamais présentée comme expérience professionnelle.
- Si la convention de stage vaut UNKNOWN, ne dis jamais qu'elle est disponible ; n'en parle que si l'offre l'exige et indique qu'elle est à confirmer.
- Respecte les dates, scores et montants exactement tels qu'ils apparaissent dans le CV.
- recipientEmail doit rester vide sauf si l'adresse apparaît littéralement dans le texte de l'offre. recipientName doit rester vide s'il n'est pas explicitement identifiable.
- La langue de la lettre et du mail doit suivre la langue de l'offre.
- Lettre de motivation : 300 à 420 mots environ, une page, professionnelle, spécifique à l'offre, sobre, sans flatterie, sans tiret cadratin, sans phrases génériques inutiles.
- Mail : 70 à 130 mots environ, direct et naturel. Ne prétends jamais qu'une pièce jointe ou une démarche existe si ce n'est pas demandé ici.
- L'objet du mail tient sur une ligne et ne contient aucun retour à la ligne.
- summary : 2 à 4 phrases factuelles maximum résumant le poste et les principaux attendus.
`;

function normalizeLanguage(value: string, fallback: "FR" | "EN") {
  return /^en/i.test(value.trim()) ? "EN" : /^fr/i.test(value.trim()) ? "FR" : fallback;
}

function detectLanguage(text: string): "FR" | "EN" {
  const sample = ` ${text.toLowerCase().slice(0, 12000)} `;
  const en = [" the ", " and ", " you ", " your ", " role ", " responsibilities ", " required ", " experience "]
    .reduce((n, term) => n + (sample.split(term).length - 1), 0);
  const fr = [" le ", " la ", " les ", " de ", " et ", " vous ", " poste ", " missions ", " profil "]
    .reduce((n, term) => n + (sample.split(term).length - 1), 0);
  return en > fr ? "EN" : "FR";
}

function validEmail(value: string) {
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.trim());
}

function explicitEmails(text: string) {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((v) => v.toLowerCase()))];
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9À-ÿ _.-]/g, "").replace(/\s+/g, "_").slice(0, 80) || "Candidature";
}

function latestCv(documents: Document[], preferred: "AUTO" | "FR" | "EN", offerText: string) {
  const detected = preferred === "AUTO" ? detectLanguage(offerText) : preferred;
  const cvs = documents
    .filter((d) => d.type === "CV")
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));
  const selected = cvs.find((d) => d.cvLanguage === detected) || cvs[0];
  if (!selected) throw new Error("Ajoutez d'abord votre CV dans Paramètres.");
  return { doc: selected, desiredLanguage: detected as "FR" | "EN" };
}

async function createVersionedDocument(
  repo: SheetsRepository<Document>,
  existing: Document[],
  applicationId: string,
  type: string,
  filenameBase: string,
  text: string,
) {
  const version =
    1 +
    Math.max(
      0,
      ...existing
        .filter((d) => d.applicationId === applicationId && d.type === type)
        .map((d) => d.version),
    );
  const doc = await repo.create({
    ...entity(),
    applicationId,
    type,
    filename: `${filenameBase}_v${version}`,
    text,
    version,
    usedForApplication: false,
    quality: "Généré automatiquement à partir de l'offre et du CV ; relecture humaine requise",
  });
  existing.push(doc);
  return doc;
}

export async function prepareLiteApplication(
  token: string,
  input: {
    url?: string;
    offerText: string;
    cvPreference: "AUTO" | "FR" | "EN";
    recipient?: string;
  },
) {
  const offerText = input.offerText.trim().slice(0, 24_000);
  if (offerText.length < 120)
    throw new Error("Ajoutez un descriptif d'offre suffisamment complet, une URL lisible ou un PDF.");

  const documentRepo = new SheetsRepository<Document>(token, "Documents");
  const documents = await documentRepo.findAll();
  const { doc: cv, desiredLanguage } = latestCv(documents, input.cvPreference, offerText);
  if (!cv.text?.trim()) throw new Error("Le CV sélectionné ne contient pas de texte exploitable.");

  const profile =
    (await new SheetsRepository<Profile>(token, "Profile").findById("profile")) ||
    defaultProfile;

  const generated = await ai(
    instruction,
    {
      OFFER: offerText,
      OFFER_URL: input.url || "",
      CV_LANGUAGE: cv.cvLanguage || desiredLanguage,
      CV_TEXT: cv.text.slice(0, 24_000),
      CANDIDATE: {
        name: profile.name,
        availability: profile.availability,
        location: profile.location,
        convention: profile.convention,
        writingRules: profile.writingRules,
      },
    },
    resultSchema,
    { maxOutputTokens: 3800 },
  );

  const language = normalizeLanguage(generated.language, desiredLanguage);
  const sourceEmails = explicitEmails(offerText);
  const manualRecipient = (input.recipient || "").trim().toLowerCase();
  if (manualRecipient && !validEmail(manualRecipient))
    throw new Error("L'adresse email saisie n'est pas valide.");
  const generatedEmail = generated.recipientEmail.trim().toLowerCase();
  const recipient = manualRecipient || (sourceEmails.includes(generatedEmail) ? generatedEmail : sourceEmails[0] || "");

  const appRepo = new SheetsRepository<Application>(token, "Applications");
  const applications = await appRepo.findAll();
  const normalizedUrl = (input.url || "").trim();
  let app = normalizedUrl
    ? applications.find((a) => a.officialUrl === normalizedUrl)
    : undefined;

  if (!app) {
    const id = createHash("sha256")
      .update(`${normalizedUrl}|${generated.company}|${generated.jobTitle}|${offerText.slice(0, 500)}`)
      .digest("hex")
      .slice(0, 24);
    app = await appRepo.create({
      ...entity(id),
      company: generated.company,
      jobTitle: generated.jobTitle,
      location: generated.location,
      contractType: "",
      startDate: "",
      reference: "",
      vertical: "Finance",
      priority: "B",
      careerPriority: "",
      status: "Prête à envoyer",
      stage: "Candidature",
      officialUrl: normalizedUrl,
      description: offerText,
      publicationDate: "",
      deadline: "",
      nextAction: "Relire le brouillon Gmail puis envoyer",
      nextActionDate: "",
      applicationDate: "",
      lastInteraction: "",
      notes: generated.summary,
      isWatch: false,
      ignored: false,
      sources: normalizedUrl
        ? [{ url: normalizedUrl, title: generated.jobTitle, content: offerText.slice(0, 2000), checkedAt: new Date().toISOString(), isOfficial: true }]
        : [],
      cvVersion: cv.filename,
      preparedAt: new Date().toISOString(),
    });
  } else {
    app = await appRepo.update(app.id, {
      company: generated.company,
      jobTitle: generated.jobTitle,
      location: generated.location,
      description: offerText,
      notes: generated.summary,
      cvVersion: cv.filename,
      preparedAt: new Date().toISOString(),
      status: app.applicationDate ? app.status : "Prête à envoyer",
      nextAction: app.applicationDate ? app.nextAction : "Relire le brouillon Gmail puis envoyer",
    });
  }

  const filenameBase = `${safeName(generated.company)}_${safeName(generated.jobTitle)}`;
  const offerDoc = await createVersionedDocument(
    documentRepo,
    documents,
    app.id,
    "Offre",
    `Offre_${filenameBase}`,
    offerText,
  );
  const lmDoc = await createVersionedDocument(
    documentRepo,
    documents,
    app.id,
    "LM",
    `LM_${filenameBase}`,
    generated.coverLetter.trim(),
  );
  const emailDoc = await createVersionedDocument(
    documentRepo,
    documents,
    app.id,
    "Email",
    `Email_${filenameBase}`,
    `${generated.emailSubject.trim()}\n\n${generated.emailBody.trim()}`,
  );

  try {
    const exported = await exportDocument(token, lmDoc, "pdf");
    await documentRepo.update(lmDoc.id, {
      driveFileId: exported.id,
      driveUrl: exported.webViewLink,
      mimeType: "application/pdf",
    });
  } catch {
    // The Gmail draft still receives an in-memory PDF below; Drive export is convenient but non-blocking.
  }

  if (!cv.driveFileId) throw new Error("Le CV choisi n'est pas disponible dans Google Drive. Réimportez-le dans Paramètres.");
  const cvBytes = await downloadDrive(token, cv.driveFileId);
  const lmBytes = await renderPdf(generated.coverLetter.trim());
  const gmailDraft = await draft(
    token,
    recipient,
    generated.emailSubject.trim(),
    generated.emailBody.trim(),
    [
      {
        name: cv.filename,
        bytes: cvBytes,
        mime: cv.mimeType || (cv.filename.toLowerCase().endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf"),
      },
      {
        name: `${lmDoc.filename}.pdf`,
        bytes: lmBytes,
        mime: "application/pdf",
      },
    ],
  );

  const draftMail: Mail = {
    id: gmailDraft.message.id,
    threadId: gmailDraft.message.threadId,
    subject: generated.emailSubject.trim(),
    from: "",
    date: new Date().toISOString(),
    text: generated.emailBody.trim().slice(0, 5000),
    labels: ["DRAFT"],
  };
  app = await appRepo.update(app.id, {
    gmailHistory: [draftMail, ...(app.gmailHistory || []).filter((m) => m.id !== draftMail.id)].slice(0, 10),
    gmailCheckedAt: new Date().toISOString(),
  });

  const interactionRepo = new SheetsRepository<Interaction>(token, "Interactions");
  await interactionRepo.create({
    ...entity(),
    applicationId: app.id,
    type: "Brouillon Gmail",
    summary: recipient
      ? `Brouillon prêt pour ${recipient}. CV et LM joints. Aucun email envoyé.`
      : "Brouillon prêt sans destinataire. CV et LM joints. Aucun email envoyé.",
    gmailMessageId: gmailDraft.message.id,
    threadId: gmailDraft.message.threadId,
  });

  if (recipient) {
    const contactRepo = new SheetsRepository<Contact>(token, "Contacts");
    const contacts = await contactRepo.findAll();
    const existingContact = contacts.find(
      (c) => c.company.toLowerCase() === generated.company.toLowerCase() && c.email.toLowerCase() === recipient,
    );
    if (!existingContact) {
      await contactRepo.create({
        ...entity(),
        applicationId: app.id,
        company: generated.company,
        name: generated.recipientName.trim() || "Recrutement",
        role: "Recrutement",
        type: "Recruiter",
        email: recipient,
        emailStatus: "VERIFIED_PUBLIC",
        linkedin: "",
        source: normalizedUrl || "Offre importée",
        alumniSkema: false,
        relevance: "Destinataire de la candidature",
        primary: true,
      });
    }
  }

  return {
    application: app,
    documents: { offer: offerDoc, letter: lmDoc, email: emailDoc, cv },
    draftId: gmailDraft.id,
    recipient,
    language,
    summary: generated.summary,
  };
}

import { z } from "zod";
export const matchingSchema = z.object({
  requirement: z.string(),
  evidenceIds: z.array(z.string()),
  type: z.enum(["DIRECT", "TRANSFERABLE", "ACADEMIC", "NOT_DEMONSTRATED"]),
  explanation: z.string(),
});
export const analysisSchema = z.object({
  summary: z.string(),
  missions: z.array(z.string()),
  mustHave: z.array(z.string()),
  niceToHave: z.array(z.string()),
  recruiterTests: z.array(z.string()),
  matches: z.array(matchingSchema),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  forbiddenClaims: z.array(z.string()),
  cvLanguage: z.enum(["FR", "EN"]),
  fitScore: z.number().min(0).max(100),
  fitDetails: z.array(
    z.object({
      dimension: z.string(),
      score: z.number().min(0).max(10),
      reason: z.string(),
    }),
  ),
  strategy: z.string(),
  companyFacts: z.array(z.object({ fact: z.string(), sourceUrl: z.string() })),
});
export const contactSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        type: z.string(),
        email: z.string(),
        linkedin: z.string(),
        source: z.string(),
        alumniSkema: z.boolean(),
        relevance: z.string(),
      }),
    )
    .max(3),
});
export const jobSchema = z.object({
  company: z.string(),
  jobTitle: z.string(),
  location: z.string(),
  contractType: z.string(),
  startDate: z.string(),
  reference: z.string(),
  vertical: z.string(),
  publicationDate: z.string(),
  deadline: z.string(),
  language: z.enum(["FR", "EN"]),
});
export const deliverablesSchema = z.object({
  coverLetter: z.string(),
  emailSubject: z.string(),
  email: z.string(),
  linkedinConnection: z.string(),
  linkedinMessage: z.string(),
  inmail: z.string(),
  claims: z.array(
    z.object({
      claim: z.string(),
      evidenceIds: z.array(z.string()),
      sourceUrls: z.array(z.string()),
    }),
  ),
});
export const mailSchema = z.object({
  applicationId: z.string(),
  classification: z.enum([
    "APPLICATION_CONFIRMATION",
    "RECRUITER_REPLY",
    "INTERVIEW_INVITE",
    "CASE_STUDY",
    "ONLINE_TEST",
    "REQUEST_FOR_INFORMATION",
    "FOLLOW_UP",
    "REJECTION",
    "OFFER",
    "NETWORK_REPLY",
    "JOB_ALERT",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(1),
  detectedStage: z.string(),
  suggestedAction: z.string(),
  reason: z.string(),
});

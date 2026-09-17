export const statuses = [
  "Inbox",
  "À analyser",
  "À préparer",
  "Prête à envoyer",
  "Envoyée",
  "Relance",
  "En process",
  "Offre",
  "Refus",
  "Clôturée",
] as const;
export type Status = (typeof statuses)[number];
export const verticals = [
  "Private Equity",
  "Public Markets",
  "Private Credit",
  "M&A",
  "Corporate Development",
  "Transaction Services",
  "Asset Management",
] as const;
export const stages = [
  "Candidature",
  "Test / Case",
  "Entretien 1",
  "Entretien 2",
  "Entretien final",
  "Références",
  "Décision",
  "Offre",
] as const;
export type Entity = { id: string; createdAt: string; updatedAt: string };
export type Source = {
  url: string;
  title: string;
  content: string;
  checkedAt: string;
  isOfficial?: boolean;
};
export type Evidence = {
  id: string;
  category: string;
  fact: string;
  source: string;
  type: "DIRECT" | "TRANSFERABLE" | "ACADEMIC" | "NOT_DEMONSTRATED";
};
export type Matching = {
  requirement: string;
  evidenceIds: string[];
  type: Evidence["type"];
  explanation: string;
};
export type Analysis = {
  summary: string;
  missions: string[];
  mustHave: string[];
  niceToHave: string[];
  recruiterTests: string[];
  timingIssues?: string[];
  matches: Matching[];
  strengths: string[];
  gaps: string[];
  forbiddenClaims: string[];
  cvLanguage: "FR" | "EN";
  fitScore: number;
  fitDetails: { dimension: string; score: number; reason: string }[];
  strategy: string;
  companyFacts: { fact: string; sourceUrl: string }[];
};
export type Application = Entity & {
  company: string;
  jobTitle: string;
  location: string;
  contractType: string;
  startDate: string;
  reference: string;
  vertical: string;
  priority: "A" | "B" | "C";
  careerPriority: string;
  status: Status;
  stage: string;
  officialUrl: string;
  description: string;
  publicationDate: string;
  deadline: string;
  nextAction: string;
  nextActionDate: string;
  applicationDate: string;
  lastInteraction: string;
  notes: string;
  isWatch: boolean;
  ignored: boolean;
  analysis?: Analysis;
  legacyEvidenceMap?: {
    requirement: string;
    evidence: string;
    source: string;
    evidenceType: string;
  }[];
  sources: Source[];
  gmailCheckedAt?: string;
  gmailHistory?: Mail[];
  cvVersion?: string;
  preparedAt?: string;
};
export type Contact = Entity & {
  applicationId: string;
  company: string;
  name: string;
  role: string;
  type: string;
  email: string;
  emailStatus: "VERIFIED_PUBLIC" | "PROBABLE_PATTERN" | "NOT_FOUND";
  linkedin: string;
  source: string;
  alumniSkema: boolean;
  relevance: string;
  primary: boolean;
};
export type Document = Entity & {
  applicationId: string;
  type: string;
  filename: string;
  text: string;
  version: number;
  driveFileId?: string;
  driveUrl?: string;
  usedForApplication: boolean;
  quality: string;
  cvLanguage?: string;
  mimeType?: string;
};
export type Interaction = Entity & {
  applicationId: string;
  type: string;
  summary: string;
  gmailMessageId?: string;
  threadId?: string;
  classification?: string;
  confidence?: number;
  oldStatus?: string;
  newStatus?: string;
  requiresReview?: boolean;
  completed?: boolean;
  proposedPatch?: Partial<Application>;
  suggestion?: string;
};
export type Mail = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  text: string;
  labels: string[];
};
export type Profile = Entity & {
  name: string;
  availability: string;
  location: string;
  convention: "UNKNOWN" | "AVAILABLE" | "NOT_AVAILABLE";
  evidence: Evidence[];
  writingRules: string;
  instructions: string;
};
export type Settings = Entity & {
  preferredLocations: string;
  keywords: string;
  negativeKeywords: string;
  excludedCompanies: string;
  gmailLabels: boolean;
  autoStatus: boolean;
  threshold: number;
  watchQueries: string[];
  lastGmailSync?: string;
  gmailPageToken?: string;
  gmailWindowAfter?: number;
  gmailWindowStarted?: string;
};
export type SyncLog = Entity & {
  type: string;
  status: string;
  itemsProcessed: number;
  errors: string[];
};
export type Snapshot = {
  applications: Application[];
  contacts: Contact[];
  documents: Document[];
  interactions: Interaction[];
  profile: Profile;
  settings: Settings;
  logs: SyncLog[];
  connections: Record<string, boolean>;
  email: string;
  demo: boolean;
};
export const defaultProfile: Profile = {
  id: "profile",
  name: "",
  availability: "2027-01",
  location: "Paris",
  convention: "UNKNOWN",
  evidence: [],
  writingRules:
    "Sobre, précis, factuel, phrases courtes. Vouvoiement. Aucun superlatif ni flatterie. Pas de tiret cadratin. Disponibilité janvier 2027. Anglais naturel si offre anglophone.",
  instructions:
    "CV prioritaire sur les instructions en cas de conflit. Classifications DIRECT, TRANSFERABLE, ACADEMIC, NOT_DEMONSTRATED. Aucun fait inventé.",
  createdAt: "",
  updatedAt: "",
};
export const defaultSettings: Settings = {
  id: "settings",
  preferredLocations: "Paris",
  keywords:
    "private equity, investment analyst, private credit, M&A, equity research",
  negativeKeywords: "senior, director, retail banking",
  excludedCompanies: "",
  gmailLabels: false,
  autoStatus: true,
  threshold: 0.92,
  watchQueries: [
    "Private Equity analyst Paris January 2027 careers",
    "Public equities investment analyst junior Paris careers",
    "Private Credit analyst Paris January 2027 careers",
    "M&A analyst CDI Paris careers",
    "Investment analyst intern Paris January 2027 site:myworkdayjobs.com",
  ],
  createdAt: "",
  updatedAt: "",
};

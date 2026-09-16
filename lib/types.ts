export const APPLICATION_STATUSES = [
  'Inbox','À analyser','À préparer','Prête à envoyer','Envoyée','Relance','En process','Offre','Refus','Clôturée'
] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export const APPLICATION_STAGES = ['Candidature','Test / Case','Entretien 1','Entretien 2','Entretien final','Références','Décision','Offre'] as const;
export type ApplicationStage = typeof APPLICATION_STAGES[number];

export type Priority = 'A' | 'B' | 'C';
export type EvidenceType = 'DIRECT' | 'TRANSFERABLE' | 'ACADEMIC' | 'NOT_DEMONSTRATED';

export interface EvidenceItem {
  requirement: string;
  evidence: string;
  source: string;
  evidenceType: EvidenceType;
  confidence: number;
}

export interface Application {
  id: string;
  company: string;
  jobTitle: string;
  reference?: string;
  location?: string;
  contractType?: string;
  vertical: string[];
  priority: Priority;
  careerPriority?: Priority;
  status: ApplicationStatus;
  stage: ApplicationStage;
  fitScore?: number;
  officialUrl?: string;
  sourceUrls?: string[];
  publicationDate?: string;
  startDate?: string;
  deadline?: string;
  applicationDate?: string;
  lastInteraction?: string;
  nextAction?: string;
  nextActionDate?: string;
  channel?: string;
  cvVersion?: string;
  coverLetterReady?: boolean;
  emailReady?: boolean;
  linkedinReady?: boolean;
  formReady?: boolean;
  gaps?: string[];
  strengths?: string[];
  contacts?: Contact[];
  coverLetter?: string;
  applicationEmail?: string;
  linkedinMessage?: string;
  jobSnapshot?: string;
  companyResearch?: string;
  evidenceMap?: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

export interface Contact {
  id: string;
  company: string;
  name: string;
  role: string;
  type: 'Recruteur'|'RH / Talent'|'Manager'|'Analyst / Associate'|'Alumni'|'Autre';
  linkedin?: string;
  email?: string;
  emailStatus: 'Public vérifié'|'Probable'|'Non trouvé';
  alumniSkema?: boolean;
  source?: string;
  relevance?: 'Principale'|'Secondaire'|'Réseau';
  lastContact?: string;
  notes?: string;
}

export interface Interaction {
  id: string;
  applicationId: string;
  type: string;
  date: string;
  channel: string;
  contactId?: string;
  gmailMessageId?: string;
  subject?: string;
  summary?: string;
  aiClassification?: string;
  confidence?: number;
}

export interface PreparationResult {
  jobAnalysis: {
    missions: string[];
    mustHave: string[];
    niceToHave: string[];
    recruiterTests: string[];
  };
  evidenceMap: EvidenceItem[];
  strengths: string[];
  gaps: string[];
  companyResearch: string;
  recommendedCv: string;
  coverLetter: string;
  applicationEmail: string;
  linkedinMessage: string;
  nextAction: string;
}

export const candidateProfile = {
  name: 'Léo CHETY',
  location: 'Paris',
  availability: 'Janvier 2027',
  internshipConventionStatus: 'UNKNOWN' as const,
  education: [
    { school: 'SKEMA Business School', program: 'Programme Grande École / Master in Management — MSc Corporate Finance', period: '2023-2026' },
    { school: 'Université Côte d’Azur', program: 'Licence Économie et Gestion', period: '2020-2023' }
  ],
  languages: [
    'Français : langue maternelle',
    'Anglais : TOEIC 885/990',
    'Espagnol : B2',
    'Mandarin : notions',
    'Portugais : notions'
  ],
  tools: ['Excel avancé','PowerPoint','Python','VBA','Power BI (PL-300)','Zoho CRM','Salesforce','Pappers','WordPress','IA / agents / automatisation'],
  experiences: [
    {
      company: 'Triactis', role: 'Analyste M&A', period: 'juillet 2026 - présent',
      evidence: [
        'Exécution de process sell-side small/mid-cap de la prise de mandat aux phases de due diligence, négociation et pré-closing',
        'Interactions directes avec dirigeants, réunions acquéreurs/cédants, structuration et price anchoring',
        'Analyse de comptes statutaires et FEC, normalisation et ajustements EBITDA/EBE',
        'Valorisations multicritères sous Excel : DCF, comparables transactionnels, multiples de chiffre d’affaires / honoraires récurrents / EBITDA ajusté',
        'Teaser, Information Memorandum, NDA, buyer lists, outreach, due diligence et LOI',
        'Automatisation du deal flow via Excel/VBA, Python, Zoho CRM et agents IA'
      ]
    },
    {
      company: 'Cdiscount', role: 'Corporate Performance & Investment Analyst', period: 'juillet-décembre 2024',
      evidence: ['Modèles de sensibilité Excel','Analyse de marges','+21 % de business volume sur certains segments stratégiques','Recommandations d’allocation de capital fondées sur rendement/risque','Environ +12 % de ROI moyen sur certains budgets','Reporting EBITDA / LTV / CAC destiné au management']
    },
    {
      company: 'Dior Couture / LVMH', role: 'UHNWI Client Advisor', period: 'janvier-juillet 2024',
      evidence: ['Forecasting et analyse de performance catégories','Clientèle internationale UHNWI','Environ 40 k€ de revenus incrémentaux documentés via cross-selling']
    },
    {
      company: 'Diandro Digital', role: 'Financial Analyst', period: 'avril-septembre 2023',
      evidence: ['Audit de rentabilité, marge, ROI et coûts','Revues financières mensuelles','Identification d’un segment destructeur de valeur','Réallocation budgétaire avec amélioration d’environ 15 % du ROI']
    }
  ],
  projects: [
    'Création de deux SAS, dont LJMS e-commerce avec jusqu’à environ 60 k€ de chiffre d’affaires mensuel documenté',
    'Genwork : activité d’affiliation, base de plus d’un million de contacts, développement et exploitation de sites',
    'Développement d’outils d’automatisation M&A et d’agents IA',
    'Application personnelle de gestion patrimoniale / Family Office en Next.js / TypeScript',
    'Secrétaire Général de SKYTEK AI en 2023'
  ],
  forbiddenClaims: [
    'Ne jamais présenter le M&A Triactis comme une expérience Private Equity',
    'Ne jamais transformer un cours de LBO en expérience LBO',
    'Ne jamais inventer credit underwriting, trading ou portfolio construction',
    'Ne jamais revendiquer Bloomberg, Capital IQ, FactSet ou PitchBook sans preuve ultérieure',
    'Ne jamais transformer TOEIC 885 en fluent/bilingual/native',
    'Ne jamais utiliser un classement Financial Times sans vérification exacte du programme concerné'
  ]
};

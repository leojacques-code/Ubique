# Ubique — Application CRM

Ubique est un cockpit personnel de candidatures finance : découverte d’offres, analyse, Evidence Engine, rédaction IA, Gmail, Google Sheets, contacts, pipeline, suivi automatique et analytics.

## Principes

**COMPRENDRE → RECHERCHER → VÉRIFIER → MAPPER LES PREUVES → SÉLECTIONNER → RÉDIGER → VALIDER → POSTULER → SUIVRE**

- Priorités : Private Equity, Hedge Funds / Public Markets, Private Credit, M&A / IB, puis Corporate Development, TS et Asset Management.
- Zéro invention candidat ou entreprise.
- Google Sheets sert de datastore V1 ; le métier reste isolé de la couche de stockage.
- Gmail est lu/classé, mais aucun email n’est envoyé automatiquement.
- La veille préfère Careers/ATS et des recherches publiques à un scraping LinkedIn fragile.
- `OPENAI_MODEL` est configurable ; l’intégration utilise l’API OpenAI Responses.

## Démarrage

```bash
npm install
cp .env.example .env.local
npm run dev
```

Voir [`docs/SETUP.md`](docs/SETUP.md) pour Google OAuth, Gmail, Sheets, OpenAI, Tavily, Vercel et les crons.

## V1 incluse

- Dashboard « Aujourd’hui »
- Pipeline Kanban
- Opportunités et fiches candidature
- Profil source de vérité
- Evidence Engine
- Génération LM / email / LinkedIn
- Création de brouillon Gmail
- Labels et synchronisation Gmail côté service
- Veille via alertes + Tavily optionnel
- Google Sheets auto-créé
- Contacts
- Documents (état/version utilisée)
- Analytics de base + extension prévue (taux de réponse, temps de réponse, mots-clés, salaires, export LFO)
- Crons Vercel protégés
- Google OAuth mono-utilisateur

## Sécurité

Aucun secret n’est committé. Les données privées ne sont pas incluses dans le dépôt. En production, restreindre `ALLOWED_GOOGLE_EMAIL` à ton compte et utiliser un `APP_SESSION_SECRET` robuste.

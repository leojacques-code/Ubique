# Ubique — Setup

## 1. Local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sans clés, l’interface fonctionne en mode démo en lecture. Les écritures réelles exigent Google.

## 2. Google Cloud

Créer un projet Google Cloud et activer :
- Gmail API
- Google Drive API
- Google Sheets API

Créer un OAuth Client **Web application**. Ajouter :
- `http://localhost:3000/api/auth/google/callback`
- l’URL Vercel de production suivie de `/api/auth/google/callback`

Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ALLOWED_GOOGLE_EMAIL`.

Scopes demandés : identité, Gmail modify/compose, Drive file, Sheets. Ubique ne supprime jamais un email et ne l’envoie jamais automatiquement.

### Cron autonome

Les crons Vercel n’ont pas de session navigateur. Pour les activer, générer une fois un refresh token Google avec consentement offline puis le placer dans `GOOGLE_REFRESH_TOKEN`. Ne jamais le committer.

## 3. OpenAI

Créer une clé API dans OpenAI Platform et renseigner :
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5.6` (modifiable sans changer le code)

Le projet utilise la Responses API via le SDK officiel `openai`.

## 4. Recherche web optionnelle

Renseigner `TAVILY_API_KEY` pour la découverte et les occurrences publiques. Sans Tavily, le CRM, Gmail, Sheets et la préparation sur une fiche de poste fournie continuent à fonctionner.

## 5. Google Sheets

Si `GOOGLE_SPREADSHEET_ID` est vide, Ubique cherche un fichier `Application CRM` dans Drive et le crée s’il n’existe pas. Les onglets prévus sont : Applications, Companies, Contacts, Interactions, Documents, JobSources, Profile, Evidence, Settings, SyncLog.

## 6. Vercel

Importer le repository GitHub `leojacques-code/Ubique` dans Vercel. Ajouter les variables d’environnement. Définir `APP_URL` et `GOOGLE_REDIRECT_URI` avec le domaine de production.

Créer `CRON_SECRET`. Les routes cron refusent toute requête sans `Authorization: Bearer <CRON_SECRET>`.

Les schedules dans `vercel.json` :
- veille : 06:00 UTC
- Gmail sync : 16:00 UTC

## 7. Règles métier

- Source candidat = profil structuré, jamais invention.
- ATS / Careers officiel > autre job board.
- Préparation automatique, envoi humain.
- Emails déduits d’un pattern = « Probable », jamais « Public vérifié ».
- Un contact principal, éventuellement un secondaire.
- Une candidature conserve la version de CV/LM réellement utilisée.

## 8. Limites V1 assumées

- Pas de scraping agressif LinkedIn.
- Pas de soumission automatique ATS.
- Pas de multi-user ni billing.
- Les PDF/DOCX et le Drive versionné sont la prochaine couche : le texte généré est déjà conservé dans la candidature, mais la conversion documentaire peut être ajoutée sans changer le modèle métier.

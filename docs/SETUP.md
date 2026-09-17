# Ubique — Setup

## 1. Local

```bash
npm ci
cp .env.example .env.local
npm run preflight
npm run dev
```

Sans clés, l’interface fonctionne en mode démo en lecture. Les écritures réelles exigent une session Google autorisée.

Avant tout push :

```bash
npm run security:scan
npm run typecheck
npm run build
```

`security:scan` ne révèle jamais les secrets trouvés : il affiche uniquement le fichier et le type de secret potentiel.

## 2. Google Cloud

Créer un projet Google Cloud et activer :
- Gmail API
- Google Drive API
- Google Sheets API

Créer un OAuth Client **Web application**. Ajouter :
- `http://localhost:3000/api/auth/google/callback`
- l’URL Vercel de production suivie de `/api/auth/google/callback`

Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ALLOWED_GOOGLE_EMAIL`.

En production, `ALLOWED_GOOGLE_EMAIL` est obligatoire afin que seule l’adresse propriétaire puisse ouvrir une session exploitable.

Scopes demandés : identité, Gmail readonly/compose, Drive file, Sheets. Le scope Gmail modify n’est demandé que pour les parcours qui nécessitent les labels. Ubique ne supprime jamais un email et ne l’envoie jamais automatiquement.

### Cron autonome

Les crons Vercel n’ont pas de session navigateur. Pour les activer, générer une fois un refresh token Google avec consentement offline via `npm run google:connect`, puis placer `GOOGLE_REFRESH_TOKEN_ENCRYPTED` dans Vercel. `GOOGLE_REFRESH_TOKEN` reste accepté pour compatibilité. Ne jamais committer ces valeurs.

## 3. IA — gratuit recommandé avec OpenRouter

Ubique supporte deux fournisseurs : **OpenRouter** et **OpenAI**. Il n’existe aucun fallback payant automatique : le fournisseur actif est déterminé par `AI_PROVIDER`, ou automatiquement par la présence d’une clé OpenRouter puis OpenAI.

### Option recommandée : OpenRouter gratuit

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_FAST_MODEL=openrouter/free
OPENROUTER_DATA_COLLECTION=deny
OPENROUTER_ZDR=false
```

`openrouter/free` laisse OpenRouter sélectionner un modèle gratuit compatible avec la requête. Les sorties structurées JSON utilisées par Ubique restent demandées par l’application.

Par défaut, Ubique envoie `provider.data_collection=deny` afin d’exclure les endpoints signalés comme collectant les données de façon non transitoire / pour entraînement. `OPENROUTER_ZDR=true` force en plus Zero Data Retention, mais peut réduire la disponibilité des endpoints gratuits ; il est donc optionnel.

Les en-têtes `HTTP-Referer` (si `APP_URL` existe) et `X-Title: Ubique` sont ajoutés pour OpenRouter. Les clés restent exclusivement côté serveur.

### Alternative OpenAI

Pour utiliser OpenAI à la place :

```env
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
OPENAI_FAST_MODEL=gpt-5.6-luna
```

Les anciennes variables OpenAI restent compatibles. Les clés doivent rester dans `.env.local` ou dans les variables chiffrées du provider de déploiement, jamais dans Git.

### Variables génériques / avancées

`AI_MODEL`, `AI_FAST_MODEL` et `AI_BASE_URL` peuvent surcharger les valeurs génériques. `OPENROUTER_BASE_URL` et `OPENAI_BASE_URL` permettent une surcharge spécifique au fournisseur. Pour le déploiement normal, ne pas les renseigner.

## 4. Recherche web optionnelle

Renseigner `TAVILY_API_KEY` pour :

- la veille ;
- les occurrences cross-platform d’une même offre ;
- la recherche de contacts publics ;
- la recherche entreprise utilisée dans la préparation.

L’enrichissement contacts applique un garde-fou supplémentaire : une adresse email n’est enregistrée comme `Public vérifié` que si l’adresse exacte est visible dans la source publique fournie au moteur. Aucun pattern d’email n’est inventé.

Sans Tavily, le CRM, Gmail, Sheets et la préparation sur une fiche de poste fournie continuent à fonctionner.

## 5. Google Sheets

Si `GOOGLE_SPREADSHEET_ID` est vide, Ubique cherche un fichier `Application CRM` dans les fichiers accessibles à l’application et le crée s’il n’existe pas. Les onglets prévus sont : Applications, Companies, Contacts, Interactions, Documents, JobSources, Profile, Evidence, Settings, SyncLog.

Les réécritures complètes d’onglets commencent par vider la plage cible afin d’éviter des lignes obsolètes après réduction d’un dataset.

## 6. Vercel

Importer le repository GitHub `leojacques-code/Ubique` dans Vercel. Ajouter les variables d’environnement. Définir `APP_URL` et `GOOGLE_REDIRECT_URI` avec le domaine de production.

Créer un `APP_SESSION_SECRET` long et aléatoire et un `CRON_SECRET`. Les routes cron refusent toute requête sans `Authorization: Bearer <CRON_SECRET>`.

Les schedules dans `vercel.json` :
- veille : 06:00 UTC ;
- Gmail sync : 16:00 UTC.

Après déploiement :

```bash
npm run smoke -- https://<domaine-ubique>
```

Le smoke test vérifie `/api/health`, `/`, `/opportunities`, `/pipeline` et `/settings` sans écrire de donnée.

`/api/health` expose uniquement des booléens de configuration et le hash court du commit Vercel, jamais la valeur d’un secret. `config.ai` indique si le fournisseur actif est prêt ; `config.openrouter` et `config.openai` indiquent seulement la présence de leurs clés respectives.

## 7. Règles métier

- Source candidat = profil structuré, jamais invention.
- ATS / Careers officiel > autre job board.
- Préparation automatique, envoi humain.
- Un email déduit d’un pattern ne peut jamais être présenté comme `Public vérifié`.
- Un contact principal, éventuellement un secondaire.
- Une candidature conserve le snapshot de l’offre et la version de CV/LM réellement utilisée.
- Les actions coûteuses ou mutantes exigent une session propriétaire autorisée.

## 8. Sécurité et confidentialité

- Les pages renvoient des en-têtes `noindex/noarchive`, `DENY` pour le framing et des permissions navigateur restrictives.
- Le serveur refuse les URL de recherche manifestement locales/privées afin de réduire le risque SSRF.
- Le cookie OAuth est HttpOnly et chiffré AES-256-GCM avec `APP_SESSION_SECRET`.
- Ne jamais coller une clé API dans une issue, une PR, un log ou un snapshot de test.
- Avec OpenRouter, conserver `OPENROUTER_DATA_COLLECTION=deny` pour les données candidat. Activer `OPENROUTER_ZDR=true` seulement si la disponibilité observée reste suffisante.

## 9. Limites de cette branche GitHub

- Pas de scraping agressif LinkedIn.
- Pas de soumission automatique ATS.
- Pas de multi-user ni billing.

Voir aussi `docs/ASTRA_HANDOFF.md` et `docs/ASTRA_FINISH_PROMPT.md` avant toute reprise Astra.

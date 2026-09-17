# Application CRM

Cockpit personnel de candidature en finance, Next.js / TypeScript / Google Sheets. Aucun Supabase. Les emails sont préparés en brouillons ; **aucune route d’envoi** n’existe.

## État livré

Le code compile et dispose de tests ciblés des mécanismes critiques. Le fonctionnement avec de vrais comptes Google, OpenAI, Tavily et un déploiement Vercel doit être validé après configuration. Les connexions des plugins ChatGPT ne fournissent pas les identifiants OAuth ni les clés API du site.

Fonctions implémentées : dashboard, pipeline avec déplacement de cartes, CRUD des dossiers, import URL/texte/CSV, analyse et preuves CV, génération LM/email/LinkedIn avec audit IA, fiches entretien/formulaire/relance, contacts sourcés, historique Gmail, brouillons avec pièces jointes, synchronisation quotidienne paginée, veille, exports A4 PDF/DOCX, Drive et versions de documents.

## 1. Lancer la démo en 2 minutes

Node.js 22 minimum.

```bash
npm ci
cp .env.example .env.local
```

Dans `.env.local`, mettre `NEXT_PUBLIC_DEMO_MODE=true`, puis :

```bash
npm run dev
```

Ouvrir http://localhost:3000 et « Explorer la démonstration ». Les six opportunités sont fictives. Les modifications de démo sont conservées uniquement dans ce navigateur. Aucune connexion réelle n’est simulée. Pour le lancement personnel, remettre cette variable à `false`.

## 2. Configurer Google Cloud

Dans un projet Google Cloud dédié :

1. Activer Gmail API, Google Drive API et Google Sheets API.
2. Configurer l’écran de consentement OAuth. Pour un usage personnel en test, ajouter son adresse à la liste des utilisateurs de test.
3. Créer un client OAuth de type application Web.
4. Déclarer les URI exactes :
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3333/callback` (assistant de connexion des crons)
   - `https://VOTRE-DOMAINE/api/auth/callback` après création Vercel.
5. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_URL` et `ALLOWED_EMAIL` dans `.env.local`.
6. Générer deux secrets différents de 32 octets : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Le premier devient `TOKEN_ENCRYPTION_KEY`, le second `CRON_SECRET`. Ne jamais les committer.

`ALLOWED_EMAIL` est obligatoire : tout autre compte est refusé. La session est chiffrée AES-256-GCM, HttpOnly, SameSite=Lax et Secure en production. State + PKCE protègent OAuth. Les appels d’écriture vérifient l’origine et la session.

Scopes initiaux : identité/email, `drive.file`, `spreadsheets`, `gmail.readonly`, `gmail.compose`. Le scope compose permet techniquement l’envoi côté Google, mais le code ne l’utilise que pour créer des brouillons. Le scope `gmail.modify` n’est demandé qu’après action sur « Autoriser les labels Gmail ». Sans ce consentement supplémentaire, laisser la synchronisation des labels désactivée.

Les jetons d’applications OAuth externes en statut Testing peuvent expirer rapidement avec ces scopes. Pour une automatisation durable, vérifier les règles Google actuelles et le statut de publication/validation de son projet. Réautoriser Google en cas d’expiration.

Documentation : https://developers.google.com/identity/protocols/oauth2/web-server

## 3. Initialiser Sheets et Drive

Se connecter, ouvrir Paramètres, puis **Initialiser mon espace Google**. L’application crée/retrouve :

- un Google Sheet « Application CRM » avec Applications, Companies, Contacts, Interactions, Documents, JobSources, Profile, Evidence, Settings, SyncLog ;
- un dossier Drive « Application CRM » et les sous-dossiers CV, Letters, Job Descriptions, Applications.

Le bouton retourne les deux identifiants. Les recopier dans `GOOGLE_SPREADSHEET_ID` et `GOOGLE_DRIVE_FOLDER_ID`, puis redémarrer/redéployer. Ne pas utiliser le Sheet d’un autre outil. Si le nom existe déjà, vérifier que c’est bien ce datastore avant de reprendre ses identifiants.

Le scope `drive.file` limite l’accès Drive aux fichiers créés ou ouverts par cette application. Il ne donne pas accès automatiquement aux anciens documents présents dans Drive ou dans ChatGPT. Utiliser l’import de fichiers dans Profil.

## 4. Profil et API OpenAI

Renseigner `OPENAI_API_KEY` et `OPENAI_MODEL` avec un modèle disponible sur le compte API qui prend en charge Chat Completions et le mode JSON. L’abonnement ChatGPT n’inclut pas nécessairement ces usages API.

- Importer les CV FR/EN dans Profil. PDF, DOCX et TXT sont pris en charge, 4 Mo maximum.
- Relire les preuves extraites avant « Valider et enregistrer le profil ».
- Un fichier de profil JSON préparé séparément peut être importé sans nouvel appel IA. Il ne remplace pas l’import des fichiers CV pour les pièces jointes.
- Importer les consignes de candidature et le style rédactionnel si besoin.
- Convention de stage = inconnue par défaut. Disponibilité initiale = janvier 2027, modifiable.

Le profil fourni avec la livraison est séparé du code. Il utilise Université Côte d’Azur, cohérente avec les deux CV, et exclut des revendications utilisables le classement FT non vérifié. Aucune donnée personnelle n’est embarquée dans le bundle public ou les fixtures.

## 5. Recherche et préparation

Renseigner `TAVILY_API_KEY` pour l’extraction de pages, les recherches et la veille. Sans cette clé, le cockpit et l’ajout d’un texte collé restent disponibles. La préparation complète signale la recherche indisponible ; elle ne fabrique pas une recherche.

Sans OpenAI, la saisie manuelle société/poste/texte reste possible. Les fonctions IA sont explicitement bloquées jusqu’à configuration.

Parcours :

1. Ajouter une URL ou coller une offre.
2. Ouvrir le dossier puis « Préparer ».
3. Consulter Synthèse, Preuves, Contacts et Gmail.
4. Relire LM/email/LinkedIn. Créer une nouvelle version après modification.
5. Créer éventuellement un brouillon Gmail avec un contact à email public vérifié et choisir les pièces jointes.
6. Effectuer soi-même le dépôt sur l’ATS, puis « Confirmer mon dépôt » en sélectionnant les versions réellement utilisées.

La LM vise 400–480 mots selon les instructions jointes. L’export PDF utilise une page A4 ; si le texte dépasse, il refuse l’export au lieu de tronquer. L’export DOCX reste éditable : sa pagination dépend de Word et doit être contrôlée avant envoi. Les textes modifiés manuellement ne repassent pas automatiquement par l’audit IA.

L’audit IA réduit les erreurs ; il ne prouve pas à lui seul la vérité de toutes les affirmations. Les sources et preuves sont visibles pour la relecture humaine. Les fiches entretien, relances et réponses formulaire restent explicitement des brouillons à relire.

## 6. Synchronisations sans session ouverte

Un cookie de navigateur ne peut pas servir à Vercel Cron. Configurer une connexion hors ligne :

```bash
npm run google:connect
```

Ouvrir le lien affiché, s’authentifier avec le compte autorisé. Le script écrit `GOOGLE_REFRESH_TOKEN_ENCRYPTED` dans `.env.local` ; le jeton brut n’est jamais affiché. Ajouter la valeur chiffrée et **la même** clé `TOKEN_ENCRYPTION_KEY` dans Vercel.

Si les labels doivent fonctionner en cron, ajouter le scope `gmail.modify` au script de connexion après l’avoir choisi, puis réautoriser. La déconnexion dans le site révoque l’autorisation Google et nécessite de reconnecter aussi les crons.

`vercel.json` programme deux tâches quotidiennes en UTC :

- Gmail : 06 h 15 UTC ;
- veille : 06 h 45 UTC.

Les heures parisiennes changent avec l’heure d’été. Sur le forfait Hobby, l’heure exacte d’exécution n’est pas garantie à la minute : https://vercel.com/docs/cron-jobs/usage-and-pricing

Les routes exigent `Authorization: Bearer CRON_SECRET`. Vercel transmet ce secret automatiquement lorsqu’il est configuré. Chaque exécution consigne résultat et erreurs dans SyncLog.

Gmail : 12 messages par lot, pagination persistée, identifiants de message uniques et décision durable avant application. Au-delà, utiliser « Synchroniser Gmail maintenant » pour poursuivre immédiatement. Les anciens messages ne font pas revenir un process en arrière. Une correspondance ambiguë ou une faible confiance devient une revue humaine. Un mail sans référence, intitulé exact ou fil déjà associé peut aussi demander une revue même avec une forte confiance IA. L’analyse porte sur les sociétés du pipeline, jusqu’à 30 noms par requête dans cette V1.

## 7. GitHub et Vercel

Créer un **nouveau dépôt privé** `application-crm` dans son compte GitHub. Ne pas importer les CV ou le profil personnel dans le dépôt. Depuis ce dossier :

```bash
git init -b main
git add .
git commit -m "Build personal application CRM"
git remote add origin URL_DU_DEPOT_PRIVE
git push -u origin main
```

Importer ce dépôt dans Vercel, framework Next.js, Node 22 ou supérieur. Renseigner les variables de `.env.example`, remplacer APP_URL et GOOGLE_REDIRECT_URI par le domaine choisi, déclarer ce callback dans Google, redéployer. Aucun domaine payant nécessaire. Le projet est protégé au niveau applicatif par l’allowlist.

Ne jamais copier un secret dans le chat, dans le code client ou dans GitHub. `.gitignore` et `.vercelignore` excluent secrets, CV et dossiers privés.

Le connecteur GitHub utilisé pendant la construction n’exposait pas la création de dépôt. Aucun dépôt existant n’a été modifié. Aucun déploiement réel ou accès API du site n’est revendiqué dans cette livraison.

## 8. Architecture et limites V1

- `lib/repositories/` est la seule couche Sheets. Remplaçable par Postgres sans changer les services métier.
- Les feuilles stockent un journal append-only : eventId, entityId, timestamp, operation, payloadJSON. Les patches se fusionnent par identifiant, jamais par numéro de ligne. Il s’agit d’une adaptation à Sheets pour éviter les écrasements de lignes en concurrence ; le Sheet n’est pas un tableau directement éditable à la main.
- Companies, JobSources et Evidence sont réservées à une normalisation future. Dans cette V1, sources et preuves restent embarquées dans Applications/Profile. Cette simplification est documentée, pas présentée comme un schéma relationnel complet.
- Pas de garantie transactionnelle inter-processus dans Google Sheets. Ne pas lancer simultanément plusieurs préparations ou plusieurs synchronisations manuelles du même dossier. Les événements sont dédupliqués à la lecture et les intentions Gmail reprises après interruption, mais des exécutions strictement concurrentes nécessiteraient une base transactionnelle/outbox pour une garantie « exactement une fois ».
- Les brouillons Gmail et les exports Drive sont des actions explicites et peuvent créer plusieurs fichiers si l’utilisateur les répète. Une nouvelle version n’écrase jamais un document déjà utilisé.
- Recherche via Tavily et pages publiques : pas de connecteur natif à tous les ATS. Les fichiers `job-sources` indiquent les chemins publics, pas des scrapers authentifiés.
- La déduplication est conservatrice : référence par société, sinon société/intitulé/lieu/contrat/date normalisés. Elle ne fusionne pas automatiquement les titres traduits ambigus. Toujours vérifier l’ATS avant dépôt.
- Les résultats de recherche complémentaires incluent des sources d’entreprise et de contacts, pas seulement des occurrences strictement identiques du poste. Le lien officiel doit être confirmé dans la fiche.
- Recherche/cache simple : les recherches déjà stockées peuvent être réutilisées ; la génération récente est réutilisée pendant une heure si le profil n’a pas changé. Forcer une nouvelle version pour intégrer des nouveautés.
- Une panne Drive conserve les textes dans Sheets. Une panne Sheets est affichée et ne crée pas un faux succès. Le mode démo n’est jamais utilisé automatiquement en cas de panne.
- Données Gmail conservées : extraits courts de 10 messages par dossier, détails consultables dans Gmail. Le classifieur ne journalise pas les corps complets.
- Les fonctions longues sont limitées à 300 secondes ; un modèle trop lent ou une veille très large peut nécessiter plusieurs exécutions. Aucun worker ou orchestrateur supplémentaire en V1.
- Les notifications sont internes au tableau de bord. Pas de push mobile, pas d’email automatique de notification.
- Pas d’intégration directe à une conversation ChatGPT : assistant API embarqué et bouton « Copier le contexte ».

## Vérification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests : chiffrement et altération de session, replay et fusion des événements Sheets, dédup CDI/stage, gardes de transition Gmail, rejet de preuves inconnues, dates ouvrées, CSV multiline, export PDF A4 et blocage des débordements.

Après configuration, vérifier avec un dossier de test personnel : connexion allowlist, import CV, offre publique, préparation, brouillon Gmail, conservation Drive, relance manuelle du cron deux fois, et refus d’accès à /api/snapshot en navigation privée. Ne pas envoyer de candidature pendant ce contrôle.

La vérification visuelle via le navigateur cloud de l’environnement de construction a été bloquée pour localhost. Compilation et tests ne remplacent pas cette recette navigateur ni un essai des APIs réelles.

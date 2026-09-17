# Astra handoff — 16 septembre 2026

Ce document sert de point de reprise à faible consommation de contexte. **Ne refais pas l'audit complet du projet. Inspecte d'abord le diff local puis complète uniquement ce qui manque.**

## 1. Hiérarchie des sources

1. **Ton travail local Astra est prioritaire** lorsqu'il est plus avancé et déjà testé.
2. La branche GitHub `build/v1-application-crm` contient des compléments à réutiliser sélectivement.
3. Ne remplace jamais un module local plus robuste par une version GitHub plus simple.
4. Le comportement métier doit rester conforme aux règles de candidature : zéro invention, Evidence Engine, préparation automatique mais envoi humain.

## 2. Ce qui existe déjà côté Astra local

Éléments signalés comme déjà réalisés localement :

- modèle de données du CRM et accès restreint au compte autorisé ;
- stockage Google Sheets avec données de démonstration séparées ;
- dashboard, Kanban, fiche candidature, Evidence Engine, documents, contacts et paramètres ;
- préparation de candidature, brouillons Gmail, veille et services de synchronisation ;
- documents versionnés ;
- synchronisation Gmail **batchée et reprenable** ;
- changements de statut liés à des éléments concrets du dossier ;
- 8 tests ciblés couvrant notamment l'absence de preuve inventée, l'auto-status et le PDF une page ;
- TypeScript / compilation / tests ciblés verts lors du dernier état communiqué ;
- import du profil depuis les CV et guide de démarrage en cours de préparation.

Ne reprogramme donc pas ces briques sans constater qu'elles manquent réellement dans le workspace local.

## 3. Compléments présents sur GitHub

Branche : `build/v1-application-crm`
PR : `#1 Build Ubique Application CRM V1`

Compléments utiles à comparer/porter si absents du local :

- Next.js/TypeScript shell complet ;
- `lib/profile.ts` avec source de vérité candidat et garde-fous explicites ;
- OpenAI Responses avec `OPENAI_MODEL` principal et `OPENAI_FAST_MODEL` pour les tâches de tri/classification, avec sorties bornées ;
- Google OAuth mono-utilisateur, cookie AES-256-GCM et contrôle propriétaire sur les routes mutantes/coûteuses ;
- le refresh token Google de fond n'est plus utilisable par une requête publique interactive ;
- séparation stricte mode démo / vrai Google Sheet ;
- écriture Sheets qui supprime les lignes obsolètes **après** une écriture réussie ;
- formulaire d'ajout d'opportunité + validation serveur ;
- conservation du `jobSnapshot` et du `jobAnalysis` structuré ;
- affichage de l'offre reconstituée : missions, must-have, nice-to-have, tests recruteur et timing ;
- recherche cross-platform et contact mapping optionnels via Tavily ;
- validation stricte des contacts extraits : aucun email déduit, un email `Public vérifié` doit apparaître exactement dans la source ;
- fusion des contacts trouvés avec les contacts déjà saisis, sans les écraser ;
- crons Vercel protégés ;
- cache des access tokens Google et timeouts réseau ;
- endpoint `/api/health` ne révélant que des booléens de configuration ;
- garde-fou contre les URL serveur manifestement locales/privées ;
- en-têtes de confidentialité `noindex/noarchive`, anti-frame et permissions navigateur restrictives ;
- `package-lock.json`, installation CI déterministe via `npm ci` ;
- CI : secret scan -> npm ci -> audit dépendances critiques -> typecheck -> build ;
- scripts `preflight`, `security:scan`, `verify` et `smoke` ;
- documentation setup Vercel/Google/OpenAI.

## 4. Secret OpenAI fourni par le propriétaire

Une clé OpenAI a été fournie séparément au projet. **Ne jamais l'écrire dans Git, dans un fichier suivi, dans un log, un test snapshot ou une réponse.**

Utilisation attendue :

- local : `OPENAI_API_KEY` dans `.env.local` uniquement ;
- Vercel : variable d'environnement chiffrée `OPENAI_API_KEY` pour Preview/Production ;
- `OPENAI_MODEL=gpt-5.6` par défaut pour la préparation ;
- `OPENAI_FAST_MODEL=gpt-5.6-luna` par défaut pour les classifications/enrichissements plus légers ;
- vérifier uniquement que l'appel Responses fonctionne, sans afficher la clé.

Le code GitHub sait déjà lire ces variables ; il n'est pas nécessaire d'ajouter une autre intégration OpenAI si la version locale en possède déjà une équivalente ou meilleure.

## 5. État Vercel constaté depuis ChatGPT

Équipe Vercel accessible : `LECH` / `lech1`.

Au dernier contrôle, seuls `leo-family-office` et `leo-learning` existent. **Aucun projet Vercel Ubique n'existe encore.**

Le blocage de déploiement est donc opérationnel et non architectural : importer/lier `leojacques-code/Ubique`, puis renseigner les variables d'environnement. Le connecteur disponible dans ChatGPT ne permet pas de créer ce projet ni de pousser des secrets Vercel de manière sûre.

## 6. Travail prioritaire à finir avant expiration de session Astra

### P0 — sauvegarder le travail local

Avant toute réconciliation :

```bash
git status
git diff --stat
git add -A
git commit -m "checkpoint: Astra local Ubique before GitHub reconciliation"
```

Pousser immédiatement une branche de sauvegarde si possible. **Ne jamais risquer de perdre le travail local en essayant d'aligner le dépôt.**

### P0 — réconcilier sans réécrire

```bash
git fetch origin
git diff --stat HEAD..origin/build/v1-application-crm
git diff HEAD..origin/build/v1-application-crm -- docs .github app lib components scripts package.json package-lock.json
```

Porter uniquement les comportements absents du local. Pour Gmail sync, génération/versioning documentaire et tests déjà plus robustes localement, conserver le local.

### P0 — validation courte et unique

Après réconciliation seulement :

```bash
npm run security:scan
npm run typecheck
npm run build
```

Puis les tests ciblés Astra existants. Évite de relancer l'ensemble à chaque petit changement.

### P0 — déployer Vercel

1. créer/importer dans Vercel un projet depuis `leojacques-code/Ubique` ;
2. utiliser Node 22 ;
3. faire d'abord passer un déploiement en mode démo ;
4. configurer `APP_URL` et un `APP_SESSION_SECRET` long ;
5. ajouter `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_FAST_MODEL` ;
6. redéployer ;
7. lancer :

```bash
npm run smoke -- https://<domaine-ubique>
```

### P1 — connexion Google réelle

Configurer ensuite :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_GOOGLE_EMAIL`
- `GOOGLE_REFRESH_TOKEN` uniquement pour les crons autonomes
- `GOOGLE_SPREADSHEET_ID` si l'auto-création n'est pas retenue

Test minimal : OAuth -> lecture Sheet -> création/modification d'une candidature -> préparation -> brouillon Gmail. **Aucun envoi automatique.**

### P1 — recherche/enrichissement

Si une clé Tavily est déjà disponible, ajouter `TAVILY_API_KEY` et tester une seule candidature :

- occurrences cross-platform ;
- source officielle conservée en priorité ;
- contacts nommés ;
- aucun email inventé.

Si Tavily n'est pas disponible, ne perds pas de crédits dessus : la préparation depuis une fiche de poste reste fonctionnelle.

### P1 — test E2E unique

Sur une seule offre de test :

1. création/import ;
2. snapshot de l'offre ;
3. analyse missions/must-have/nice-to-have/tests recruteur ;
4. Evidence Engine DIRECT / TRANSFERABLE / ACADEMIC / NOT_DEMONSTRATED ;
5. LM/email/LinkedIn ;
6. sauvegarde ;
7. brouillon Gmail ;
8. mise à jour du pipeline ;
9. rechargement de la page pour vérifier la persistance.

## 7. Ce qui peut attendre après Astra

Ne dépense pas les dernières heures dessus tant que P0/P1 n'est pas validé :

- analytics avancés, salaires, conversion par canal, export LFO ;
- enrichissement massif de centaines d'opportunités ;
- recherche LinkedIn plus sophistiquée ou scraping fragile ;
- polish visuel non bloquant ;
- multi-user, billing ou architecture SaaS ;
- réécriture des documents/PDF locaux déjà stables ;
- optimisation prématurée du datastore au-delà des besoins mono-utilisateur.

## 8. Définition de « terminé » pour cette passe

La session Astra s'arrête dès que :

- le travail local est sauvegardé/poussé ;
- les meilleurs éléments du local et de `build/v1-application-crm` sont réconciliés sans régression ;
- secret scan, TypeScript, tests ciblés et build passent ;
- aucun secret n'est suivi par Git ;
- un déploiement Vercel s'ouvre ;
- le mode démo fonctionne ;
- OpenAI fonctionne avec la variable d'environnement ;
- si les credentials sont disponibles, Google OAuth + Sheet + brouillon Gmail fonctionnent ;
- le parcours principal d'une candidature est validé de bout en bout ;
- un dernier commit/push décrit uniquement les éventuels blocages externes restants.

## 9. Règle de consommation de crédits

**Checkpoint -> diff -> porter le delta -> une validation -> déployer -> un smoke E2E -> push final.**

Pas de réécriture globale, pas de nouvel audit architectural, pas de redesign, pas de nouvelle fonctionnalité hors P0/P1 tant que le déploiement end-to-end n'est pas validé.

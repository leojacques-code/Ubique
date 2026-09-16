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
- intégration OpenAI Responses via `OPENAI_API_KEY` / `OPENAI_MODEL` ;
- Google OAuth mono-utilisateur ;
- cookie de session chiffré AES-256-GCM ;
- séparation stricte mode démo / vrai Google Sheet ;
- formulaire d'ajout d'opportunité + validation serveur ;
- conservation du `jobSnapshot` après préparation ;
- recherche optionnelle Tavily ;
- crons Vercel protégés ;
- recherche d'un contact dans la base globale pour créer un brouillon Gmail ;
- CI GitHub `npm install -> typecheck -> build`, actuellement verte ;
- documentation setup Vercel/Google/OpenAI.

## 4. Secret OpenAI fourni par le propriétaire

Une clé OpenAI a été fournie séparément au projet. **Ne jamais l'écrire dans Git, dans un fichier suivi, dans un log, un test snapshot ou une réponse.**

Utilisation attendue :

- local : `OPENAI_API_KEY` dans `.env.local` uniquement ;
- Vercel : variable d'environnement chiffrée `OPENAI_API_KEY` pour Preview/Production ;
- garder `OPENAI_MODEL` configurable ;
- vérifier uniquement que l'appel Responses fonctionne, sans afficher la clé.

Le code GitHub sait déjà lire `OPENAI_API_KEY` ; il n'est donc pas nécessaire d'ajouter une autre intégration OpenAI si la version locale en possède déjà une équivalente ou meilleure.

## 5. Travail prioritaire à finir avant expiration de session Astra

### P0 — sauvegarder le travail local

Avant toute réconciliation :

```bash
git status
git diff --stat
git add -A
git commit -m "checkpoint: Astra local Ubique before GitHub reconciliation"
```

Si le push fonctionne, pousser immédiatement une branche de sauvegarde. **Ne jamais risquer de perdre le travail local en essayant d'aligner le dépôt.**

### P0 — réconcilier sans réécrire

Comparer :

```bash
git fetch origin
git diff --stat HEAD..origin/build/v1-application-crm
git diff HEAD..origin/build/v1-application-crm -- docs .github app lib components
```

Porter uniquement les comportements absents du local. Pour les modules Gmail/documents déjà plus robustes localement, conserver le local.

### P0 — validation courte

Exécuter les commandes déjà disponibles localement. Minimum :

```bash
npm run typecheck
npm run build
```

Puis les tests ciblés existants. Ne lance pas une refonte ou une batterie coûteuse supplémentaire si les tests actuels couvrent déjà les chemins critiques.

### P0 — obtenir un déploiement Vercel utilisable

Objectif : un déploiement Preview/Production qui charge au minimum le cockpit et le mode démo.

- lier `leojacques-code/Ubique` à un nouveau projet Vercel ;
- Node 22 ;
- configurer `APP_URL` ;
- ajouter `APP_SESSION_SECRET` ;
- ajouter `OPENAI_API_KEY` ;
- ne configurer Google/Tavily qu'après que le build Vercel est vert ;
- vérifier `/`, `/opportunities`, `/pipeline`, une fiche candidature et `/settings`.

### P1 — connexion Google réelle

Configurer ensuite :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_GOOGLE_EMAIL`
- `GOOGLE_REFRESH_TOKEN` uniquement si les crons autonomes sont activés
- `GOOGLE_SPREADSHEET_ID` si l'auto-création n'est pas retenue

Test minimal : OAuth -> lecture Sheet -> création/modification d'une candidature -> brouillon Gmail. Aucun envoi automatique.

### P1 — smoke test OpenAI

Sur une offre de test :

1. préparer la candidature ;
2. vérifier que le mapping distingue DIRECT / TRANSFERABLE / ACADEMIC / NOT_DEMONSTRATED ;
3. vérifier qu'aucune compétence absente n'est inventée ;
4. vérifier qu'une LM et un email sont générés ;
5. vérifier que le snapshot de l'offre est conservé.

## 6. Ce qui peut attendre après Astra

Ne dépense pas les dernières heures sur ces sujets si le P0/P1 n'est pas terminé :

- contact discovery automatique web/LinkedIn ;
- cross-platform exhaustif et déduplication avancée ATS/job boards ;
- enrichissement massif des opportunités ;
- analytics avancés, salaires, conversion par canal, export LFO ;
- synchronisation Drive/DOCX/PDF sophistiquée si la version locale n'est pas déjà stable ;
- polish visuel non bloquant ;
- multi-user, billing ou architecture SaaS.

## 7. Définition de « terminé » pour cette passe

La session Astra doit s'arrêter dès que les points suivants sont vrais :

- le travail local est sauvegardé dans Git ;
- les meilleurs éléments du local et de `build/v1-application-crm` sont réconciliés sans régression ;
- TypeScript, tests ciblés et build passent ;
- aucun secret n'est suivi par Git ;
- un déploiement Vercel s'ouvre ;
- le mode démo fonctionne ;
- idéalement OpenAI est branché ;
- idéalement Google OAuth + Sheet + brouillon Gmail sont validés ;
- un dernier commit/push documente clairement les éventuels blocages restants.

## 8. Règle de consommation de crédits

**Inspecter -> comparer -> porter le delta -> tester -> pousser.**

Pas de réécriture globale, pas de nouvel audit architectural, pas de commentaire extensif du code, pas de fonctionnalité hors P0/P1 tant que le déploiement end-to-end n'est pas validé.

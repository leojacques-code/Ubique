# Prompt final à donner à Astra

Tu reprends **Ubique** avec une contrainte de temps forte. Tu n'as pas le droit de repartir de zéro ni de réauditer toute l'architecture.

Commence par lire `docs/ASTRA_HANDOFF.md`. Il contient l'état consolidé le plus récent et la hiérarchie entre ton travail local et les compléments GitHub.

## Règle principale

**Ton workspace local est prioritaire lorsqu'il contient une version plus avancée ou déjà testée. La branche `origin/build/v1-application-crm` contient des compléments : porte seulement le delta utile. Ne remplace jamais une implémentation locale plus robuste par une version GitHub plus simple.**

Tu disposes de peu de crédit. Ton objectif est de rendre la V1 réellement terminée, sauvegardée et déployée, pas de perfectionner l'architecture.

## Ordre obligatoire

### 1. Sauvegarde locale immédiate

Exécute d'abord :

```bash
git status
git diff --stat
git add -A
git commit -m "checkpoint: Astra local Ubique before GitHub reconciliation" || true
```

Si possible, pousse immédiatement une branche de sauvegarde. Ne fais aucun merge/reset/rebase risquant de perdre le local avant ce checkpoint.

### 2. Compare, ne réécris pas

```bash
git fetch origin
git diff --stat HEAD..origin/build/v1-application-crm
git diff HEAD..origin/build/v1-application-crm -- docs .github app lib components scripts package.json package-lock.json
```

Porte seulement les comportements absents du local. Conserve en priorité les versions locales déjà plus avancées de : documents/PDF/DOCX versionnés, Gmail sync batchée/reprenable, validations de changements de statut, tests ciblés et tout module ayant déjà une meilleure couverture.

Les deltas GitHub à regarder en priorité sont listés dans `docs/ASTRA_HANDOFF.md`, notamment sécurité propriétaire, OpenAI à coût borné, recherche cross-platform/contact mapping vérifié, job snapshot/job analysis, lockfile/CI/preflight/smoke et protections Google/Vercel.

### 3. Termine uniquement le parcours principal

Le parcours doit fonctionner :

`créer/importer offre -> recherche éventuelle -> reconstituer l'offre -> Evidence Engine -> LM/email/LinkedIn -> sauvegarder -> brouillon Gmail -> pipeline`.

Aucun envoi automatique.

### 4. Une seule validation après réconciliation

```bash
npm run security:scan
npm run typecheck
npm run build
```

Puis lance les tests ciblés Astra existants, notamment zéro invention, auto-status et PDF une page. Corrige uniquement les erreurs bloquantes. Ne relance pas toute la batterie après chaque micro-changement.

### 5. Déploie Vercel avant tout polish

Il n'existe actuellement aucun projet Vercel Ubique sur l'équipe `LECH`. Crée/importe donc `leojacques-code/Ubique` dans Vercel.

Objectif d'abord : déploiement **mode démo** vert. Ensuite seulement configure les secrets.

Variables minimales :

- `APP_URL`
- `APP_SESSION_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5.6`
- `OPENAI_FAST_MODEL=gpt-5.6-luna`

La clé OpenAI a été fournie séparément par le propriétaire. **Utilise-la uniquement depuis `.env.local` et/ou les secrets Vercel. Ne l'affiche, ne la copie dans aucun fichier suivi, log, commit, issue ou snapshot.**

Après déploiement :

```bash
npm run smoke -- https://<domaine-ubique>
```

### 6. Branche Google seulement après le build vert

Si les credentials sont disponibles :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_GOOGLE_EMAIL`
- `GOOGLE_REFRESH_TOKEN` uniquement pour les tâches background
- `GOOGLE_SPREADSHEET_ID` si nécessaire
- `CRON_SECRET`

Valide une fois : OAuth -> lecture/écriture Sheet -> génération -> brouillon Gmail. Ne valide pas l'envoi réel.

### 7. Tavily est secondaire

Si `TAVILY_API_KEY` est déjà disponible, teste une seule offre avec « Rechercher sources & contacts » et vérifie qu'aucun email n'est inventé. Si la clé n'existe pas, ignore Tavily pour cette session : ce n'est pas bloquant.

### 8. Un seul smoke E2E réel

Sur une offre test :

1. création/import ;
2. snapshot de fiche ;
3. analyse missions / must-have / nice-to-have / tests recruteur ;
4. Evidence Engine DIRECT / TRANSFERABLE / ACADEMIC / NOT_DEMONSTRATED ;
5. LM/email/LinkedIn ;
6. persistance après reload ;
7. brouillon Gmail si Google est connecté ;
8. changement de pipeline ;
9. aucune invention vérifiée visuellement.

### 9. Termine par un push, pas par un nouveau chantier

```bash
git status
git add -A
git commit -m "feat: finish Ubique V1 integration"
git push
```

Si un élément externe manque, mets à jour `docs/ASTRA_HANDOFF.md` avec exactement : **blocage / cause / prochaine action**. Puis arrête-toi.

## Interdictions

- pas de réécriture globale ;
- pas de nouvel audit architectural ;
- pas de redesign non bloquant ;
- pas de nouvelle architecture datastore ;
- pas de SaaS/multi-user/billing ;
- pas de scraping LinkedIn fragile ;
- pas d'envoi automatique de candidature ou d'email ;
- pas d'invention de données candidat, entreprise, contact ou email ;
- pas de secret dans Git ou logs ;
- pas de refonte d'un module local déjà plus robuste ;
- pas de fonctionnalités hors P0/P1 tant que Vercel et le parcours E2E ne sont pas validés.

## Définition de fini

Tu t'arrêtes lorsque :

- le travail local est checkpointé et poussé ;
- les meilleurs éléments local + GitHub sont réconciliés sans régression ;
- secret scan, TypeScript, tests ciblés et build sont verts ;
- un projet Ubique Vercel existe et le site s'ouvre ;
- le mode démo passe le smoke test ;
- OpenAI fonctionne via variable d'environnement ;
- Google fonctionne si les credentials sont disponibles, sinon le seul manque est documenté ;
- une candidature test passe de bout en bout ;
- le dernier état est poussé.

**Mode de travail : checkpoint -> diff -> porter le delta -> une validation -> déployer -> un E2E -> push final.** Ne me demande pas de validation intermédiaire sauf action destructive ou credential externe réellement absent.

# Prompt final Astra — passe 20–30 minutes

Tu reprends **Ubique** pour une passe finale très courte. **Ne réaudite pas le projet et ne repars pas de zéro.**

Lis d'abord, dans cet ordre :

1. `docs/ASTRA_HANDOFF.md`
2. `docs/VERCEL_FIX.md`

Ton workspace local reste prioritaire lorsqu'il contient une implémentation plus avancée ou déjà testée. La branche `origin/build/v1-application-crm` est une source de deltas à intégrer sélectivement, jamais une raison d'écraser ton travail local.

## 1. Checkpoint immédiat

Avant toute comparaison :

```bash
git status
git diff --stat
git add -A
git commit -m "checkpoint: Astra local Ubique before final reconciliation" || true
```

Pousse une branche de sauvegarde si possible. Aucun reset/rebase/merge destructif avant ce checkpoint.

## 2. Compare uniquement le delta utile

```bash
git fetch origin
git diff --stat HEAD..origin/build/v1-application-crm
git diff HEAD..origin/build/v1-application-crm -- app lib components scripts docs .github package.json package-lock.json vercel.json
```

Conserve en priorité tes versions locales déjà plus avancées de :

- documents/PDF/DOCX versionnés ;
- Gmail sync batchée/reprenable ;
- logique auto-status déjà testée ;
- tests ciblés ;
- import profil/CV ;
- toute implémentation locale plus robuste.

Deltas GitHub récents à reprendre **uniquement s'ils manquent localement** :

- owner authorization sur actions mutantes/coûteuses ;
- isolation du refresh token Google background vis-à-vis des requêtes interactives ;
- OAuth qui échoue proprement si la config production est incomplète ;
- OpenAI principal/rapide avec sorties bornées ;
- job snapshot + job analysis structuré ;
- affichage missions / must-have / nice-to-have / recruiter tests / timing ;
- recherche cross-platform + contact mapping vérifié, sans email inventé ;
- fusion des contacts enrichis sans écraser l'existant ;
- déduplication exacte des offres par URL officielle/référence ;
- réouverture automatique de la fiche existante en cas de doublon ;
- garde-fou URL serveur / confidentialité / headers noindex ;
- Settings montrant l'état des intégrations sans exposer leurs valeurs ;
- health endpoint, preflight, secret scan et smoke distant renforcé ;
- smoke compatible avec `VERCEL_AUTOMATION_BYPASS_SECRET` si Deployment Protection est active.

## 3. Ne développe rien de nouveau

Le seul parcours à rendre impeccable est :

`créer/importer offre -> recherche éventuelle -> reconstituer offre -> Evidence Engine -> LM/email/LinkedIn -> sauvegarder -> brouillon Gmail -> pipeline`.

Aucun envoi automatique.

## 4. Validation locale unique

Après réconciliation seulement :

```bash
npm run security:scan
npm run typecheck
npm run build
```

Puis tes tests ciblés existants : zéro invention, auto-status, PDF une page et autres tests déjà présents. Corrige uniquement les blocages réels.

## 5. Vercel : ne debug pas le mauvais problème

Le projet Vercel `ubique` existe déjà.

Le premier déploiement production a pris `main` au commit initial et ne contenait pas l'application.

Un preview de `build/v1-application-crm` a ensuite prouvé que le code Next.js :

- compile correctement ;
- passe la validation TypeScript Next.js ;
- génère 19 pages ;
- expose les routes App Router/API attendues.

Le preview a échoué **après le build** uniquement parce que le projet Vercel attend actuellement un Output Directory `public`.

Corrige d'abord ce réglage, sans toucher au code métier :

```bash
vercel link
vercel project update ubique --framework nextjs
vercel project update ubique --auto-detect output-directory
vercel project update ubique --auto-detect build-command
vercel project update ubique --auto-detect install-command
```

Ou dans le dashboard : Framework Preset = Next.js, puis reset/clear Output Directory vers Auto.

Le warning Node 24 / `node >=20` n'est pas la cause de l'échec. Pour la parité avec la CI, préfère Node 22 sauf si ton local final est déjà validé sur Node 24.

## 6. Déploie la révision réconciliée

Une fois le local final intégré : pousse la révision destinée à la production puis laisse Vercel construire cette révision réelle.

Vérifie dans les logs qu'il n'y a plus l'erreur `No Output Directory named "public"`.

Puis :

```bash
npm run smoke -- https://<domaine-final>
```

Si Deployment Protection est active et qu'un bypass d'automation existe :

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<secret-local> npm run smoke -- https://<domaine-final>
```

Ne commit jamais ce secret.

## 7. Intégrations réelles

OpenAI, si la clé est disponible :

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5.6`
- `OPENAI_FAST_MODEL=gpt-5.6-luna`

Google, seulement si les credentials sont disponibles :

- `APP_URL`
- `APP_SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_GOOGLE_EMAIL`
- `GOOGLE_REFRESH_TOKEN` uniquement pour les tâches background
- `GOOGLE_SPREADSHEET_ID` si nécessaire
- `CRON_SECRET`

Valide une fois : OAuth -> Sheet -> préparation -> brouillon Gmail. **Ne teste pas un envoi réel.**

Tavily est facultatif pour cette passe. S'il n'y a pas déjà de `TAVILY_API_KEY`, n'y consacre aucun temps.

## 8. Un seul E2E

Sur une seule offre test :

1. création/import ;
2. snapshot persistant ;
3. reconstitution de l'offre ;
4. Evidence Engine DIRECT / TRANSFERABLE / ACADEMIC / NOT_DEMONSTRATED ;
5. aucune invention ;
6. LM/email/LinkedIn ;
7. reload avec persistance ;
8. brouillon Gmail si connecté ;
9. changement pipeline ;
10. vérification qu'un doublon exact rouvre la fiche existante au lieu de créer un second dossier.

## 9. Stop condition

Tu termines par :

```bash
git status
git add -A
git commit -m "feat: finish Ubique V1 integration"
git push
```

Puis arrête-toi dès que :

- local + deltas GitHub sont réconciliés sans régression ;
- secret scan, TypeScript, tests ciblés et build sont verts ;
- Vercel sert la vraie application ;
- smoke distant passe ;
- OpenAI fonctionne si configuré ;
- Google fonctionne si ses credentials sont disponibles ;
- une candidature passe de bout en bout ;
- le dernier état est poussé.

## Interdictions

Pas de nouvel audit architectural, pas de redesign, pas de nouveau datastore, pas de SaaS/multi-user/billing, pas de scraping LinkedIn fragile, pas de refonte des modules locaux déjà meilleurs, pas d'envoi automatique, pas d'invention, pas de secret dans Git/logs.

**Mode opératoire : checkpoint -> diff -> porter uniquement le delta -> une validation -> corriger Vercel -> un E2E -> push final.** Ne demande une validation intermédiaire que si une action destructive ou un credential externe réellement absent bloque la suite.

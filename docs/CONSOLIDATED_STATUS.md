# Ubique — état consolidé au 17 septembre 2026

## Référence de reprise

- Dépôt : `leojacques-code/Ubique`, branche `build/v1-application-crm`, PR #1.
- Réconciliation : `9ff7c291` (parents GitHub et checkpoint Astra conservés).
- Sauvegarde indépendante du local initial : branche `checkpoint/astra-local-20260917`, commit `292ce2dd`.
- Preview de la réconciliation : https://ubique-18kc3krqa-lech1.vercel.app — READY, recette navigateur effectuée.
- Les anciennes notes ASTRA_HANDOFF / VERCEL_FIX décrivent des états historiques. Ne pas recréer le projet Vercel ni réauditer les anciens échecs.

## Préservé et intégré

PDF A4/DOCX, versions, import CV, Gmail paginé/reprenable, intentions durables et garde-fous de statut restent ceux du local. Responses principal/rapide, finance par verticale, preuve académique séparée, timing/convention, recherche multi-plateforme, sources, contacts sourcés, URL publiques avec DNS épinglé, dates Paris et diagnostics sont intégrés.

Le stockage lit les anciennes lignes Sheets sans les effacer, puis applique les nouveaux événements append-only. Documents et contacts embarqués des anciens dossiers restent consultables. Les anciennes preuves restent affichées, sans devenir une nouvelle source candidat validée.

Les variables Google existantes restent acceptées (`ALLOWED_GOOGLE_EMAIL`, `APP_SESSION_SECRET`, `GOOGLE_REFRESH_TOKEN`) ainsi que les alias locaux. Le refresh token background ne donne jamais accès aux routes interactives. Les deux chemins de callback OAuth restent supportés.

## Vérifications réalisées

- 22 tests ciblés réussis ; TypeScript, ESLint et build Next.js réussis.
- Audit npm : aucune vulnérabilité ; scan des secrets réussi sur les 95 fichiers suivis de la réconciliation.
- CI GitHub push et PR au commit `9ff7c291` : succès.
- Vercel : réconciliation READY.
- Smoke HTTP local : pages, health, headers de confidentialité et refus des accès anonymes aux données/actions/crons.
- Navigateur sur preview : ouverture, démo, ajout fictif, changement de statut, notes conservées après rechargement.
- Dernières corrections de recette : marque Ubique cohérente ; ajout démo sans héritage d’un contrat/secteur/date fictifs ; diagnostic affichant uniquement des booléens de configuration.

## Limites externes restantes

Le preview testé signale une configuration Google OAuth incomplète. Aucune clé OpenAI ni identité OAuth du site n’est accessible dans le workspace ; les plugins ChatGPT ne fournissent pas leurs secrets au runtime du site. Ne jamais copier une clé dans Git ou dans un message.

Le smoke distant HTTP non interactif a rencontré la protection Vercel (redirection de connexion / page HTML) : ne pas le compter comme validé. La recette navigateur de la démo est bien validée via un accès temporaire du propriétaire.

Après configuration des variables Preview/Production et connexion du propriétaire, il reste à exécuter une seule vraie candidature test : import profil, préparation Responses, versions Drive, brouillon Gmail, rechargement Sheets, synchronisation. Aucun envoi de mail ne doit être testé.

Le profil personnel JSON (41 preuves tirées des CV) est livré séparément ; les CV et le profil ne sont pas dans le dépôt ni dans le bundle public.

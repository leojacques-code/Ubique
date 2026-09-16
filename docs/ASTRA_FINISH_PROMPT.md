# Prompt final à donner à Astra

Tu reprends **Ubique** avec une contrainte de temps forte. Tu n'as pas le droit de repartir de zéro ni de réauditer toute l'architecture.

Commence par lire `docs/ASTRA_HANDOFF.md`, puis inspecte immédiatement ton workspace local et compare-le à `origin/build/v1-application-crm`.

## Règle principale

**Ton workspace local est prioritaire lorsqu'il contient une version plus avancée ou déjà testée. La branche GitHub contient des compléments : tu dois porter seulement le delta utile. Ne remplace jamais une implémentation locale plus robuste par une version GitHub plus simple.**

Tu disposes d'environ quatre heures de crédit. Ton objectif n'est pas de perfectionner le produit, mais de rendre la V1 réellement terminée, sauvegardée et déployable avec le minimum de consommation.

## Ordre obligatoire

1. Fais `git status` et `git diff --stat`.
2. Sauvegarde immédiatement tout travail local non versionné dans un commit checkpoint avant toute réconciliation.
3. `git fetch origin` puis compare le local à `origin/build/v1-application-crm`.
4. Réutilise uniquement les compléments qui manquent réellement dans ton local.
5. Préserve absolument les éléments déjà plus avancés localement, notamment documents versionnés, Gmail sync batchée/reprenable, validations de statuts et tests ciblés.
6. Termine les trous fonctionnels nécessaires à un parcours end-to-end : créer/importer une opportunité -> analyser -> Evidence Engine -> générer LM/email/LinkedIn -> enregistrer -> créer un brouillon Gmail -> mettre à jour le pipeline.
7. Exécute les tests ciblés existants, `npm run typecheck`, le build et le secret scan. Corrige seulement les échecs bloquants.
8. Obtiens un déploiement Vercel au minimum en mode démo. Ensuite seulement branche les intégrations réelles.
9. Utilise `OPENAI_API_KEY` uniquement depuis l'environnement local/Vercel. **Ne l'affiche jamais et ne la commit jamais.** Le code doit continuer à lire la variable d'environnement et garder `OPENAI_MODEL` configurable.
10. Si les identifiants Google sont disponibles, valide OAuth -> Sheet -> brouillon Gmail. Sinon, laisse un chemin de configuration propre et documenté sans bloquer le mode démo.
11. Fais un dernier commit et push. Si quelque chose reste bloqué, écris exactement le blocage, la cause et l'action suivante dans `docs/ASTRA_HANDOFF.md` au lieu de lancer une nouvelle refonte.

## Interdictions

- pas de réécriture globale ;
- pas de nouvel audit architectural ;
- pas de redesign non bloquant ;
- pas de fonctionnalités SaaS/multi-user/billing ;
- pas de contact discovery sophistiqué tant que le parcours principal n'est pas validé ;
- pas de scraping LinkedIn fragile ;
- pas d'envoi automatique de candidature ou d'email ;
- pas d'invention de données candidat/entreprise ;
- pas de secret dans Git, logs ou snapshots de tests ;
- ne refais pas ce qui existe déjà juste parce que tu aurais choisi une autre architecture.

## Définition de fini

Tu t'arrêtes lorsque :

- tout le travail local est sauvegardé et poussé ;
- le meilleur du local et du GitHub est réconcilié sans régression ;
- secret scan, TypeScript, tests ciblés et build sont verts ;
- le site Vercel s'ouvre ;
- le mode démo fonctionne ;
- OpenAI fonctionne si la clé est présente ;
- Google fonctionne si les credentials sont présents, sinon la configuration manquante est explicitement documentée ;
- le parcours principal de candidature est testable de bout en bout ;
- les éventuels reliquats sont listés de façon courte et actionnable.

Travaille en mode : **inspecter -> comparer -> porter le delta -> tester -> pousser**. Ne me demande pas de validation intermédiaire sauf si une action destructive ou un secret externe absent rend la suite impossible.

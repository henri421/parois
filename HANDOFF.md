# HANDOFF — lot acier, T2 (saisie et écran)

## T2 : saisie et écran

**Fichiers modifiés**
- `app/src/form.ts` : champs `profilParoi`, `nuance`, `entraxeProfils` dans `Saisie` ; `profilButon`, `profilLierne` dans `SaisieAppui` et `nouvelAppui` ; `Calcul.acier` ; `lireAcier` (paroi null si profil vide, butons/liernes null si champ vide, nuance commune ramenée à S235, entraxe strictement positif).
- `app/src/vue.ts` : import de `verifierAcier` ; deux champs de plus dans `appuisHtml` ; paramètre `data-verification` de `carteTaux` ; groupe et cartes « Acier, EN 1993-1-1 » dans `verdictsHtml` ; ligne d'hypothèses acier (FR/EN).
- `app/index.html`, `app/en/index.html` : trois lignes de saisie dans « Paroi et excavation » (profil de berlinoise, nuance, entraxe), avec les cinq options de nuance.

**Décisions**
- Nuances connues listées localement (`S235`…`S460`) ; toute autre valeur, y compris une chaîne vide, retombe sur `S235`.
- L'entraxe des profilés n'est validé que si `profilParoi` est renseigné (une paroi absente n'a pas d'entraxe à contrôler).
- `carteTaux` reçoit `verification` en dernier paramètre, valeur par défaut `'rotation'` pour ne pas changer les appels existants.
- Le message d'erreur acier (`profil` ou `longueur`) est ajouté après la ligne des efforts, pour garder N/M/V/L visibles.
- La ligne d'hypothèses anglaise écrit `0.6` et `0.5` (point décimal) : le contrôle d'affichage anglais signale une virgule décimale, contrairement au libellé du plan.
- « déversement » accentué dans la ligne française pour passer le contrôle d'accents.

**Points douteux**
- Décimales choisies pour les efforts acier : N, M, V à 1 décimale, L à 2 (non spécifié par le plan).
- Le plan demande un typecheck à 0 erreur ; il reste une erreur hors T2, dans le bloc T3 : `tests/app/acier.test.ts:132` (« `v.taux` is possibly 'null' »), admise tant que T3 n'est pas faite.
- `verifierAcier` est appelé à chaque rendu des verdicts, sans mise en cache ; sans incidence connue.

**Statut des tests**
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/lancer.mjs . acier` : T2 **8/8**, échecs uniquement dans le bloc T3 (3 tests) ; total 14 réussis, 3 échecs.
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/lancer.mjs .` (suite complète) : 63 réussis, 3 échecs, tous dans le bloc T3 de `tests/app/acier.test.ts`.
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/typecheck.mjs .` : 1 erreur, `tests/app/acier.test.ts:132`, bloc T3.

## T3 : note et anglais

**Fichiers modifiés**
- `app/src/note.ts` : import de `verifierAcier` et `ElementAcier` ; appels `verifierAcier(calcul.donnees, r, calcul.acier)` ; une vérification par élément (nom `titreAcier, profil nuance`, clause `EN 1993-1-1, 6.2 ; 6.3`, `taux: taux ?? NaN`, `ok` faux si erreur) ; tableau `T('Acier', 'Steel')` dans `calculs`, une ligne par élément (taux via `tauxAffiche`, `—` si erreur).
- `app/src/vue.ts` : `export` ajouté devant `titreAcier` (seule modification).

**Décisions**
- `noteDuCalcul` n'a plus d'annotation de retour `: NoteDeCalcul` ; le retour est vérifié par `satisfies NoteDeCalcul` et le tableau `verifications` est typé `(VerificationNote & { taux: number })[]`, pour que `v.taux` ne soit plus `number | null` côté test (sinon l'erreur de typecheck de la ligne 132 subsistait).
- Tableau acier inséré dans `calculs` entre les tableaux de résultats et `blocsResultat`.
- Efforts affichés avec `aff` (N, M, V à 1 décimale, L à 2), comme sur l'écran.

**Points douteux**
- Aucun sur les tests ; la modification du type de retour touche l'API publique inférée de `noteDuCalcul` (les appelants restent compatibles, `satisfies` garantit `NoteDeCalcul`).

**Statut des tests**
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/lancer.mjs . acier` : `tests/app/acier.test.ts` **11/11**, `tests/acier.test.ts` 6/6, total 17 réussis, 0 échec.
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/lancer.mjs .` (suite complète) : **66 réussis, 0 échec**.
- `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/typecheck.mjs .` : **0 erreur**.

# HANDOFF — paroi phasée (lot F, PLAN-phasage.md)

Implémenté par Claude (séance maître, en autonomie) le 20/11/2026. Le compte rendu du lot acier
précédent est dans l'historique git.

## T1 : noyau (`src/phases.ts`)

**Fichiers** : `src/phases.ts` (nouveau).

**Décisions**
- Enveloppe : grille régulière de L/200, plus tous les points des courbes (les extrêmes sont donc exacts) ;
  aux sauts (points doubles), les deux valeurs entrent dans l'enveloppe.
- Phase sans appui porteur : `degreEncastrement = 1`, comme l'exige le noyau.

**Statut** : `npx vitest run tests/phases.test.ts` : 16/16 passent.

## T2 : saisie (`app/src/form.ts`)

**Fichiers** : `app/src/form.ts`.

**Décisions**
- `phasesGenerees` lit la saisie sans phasage, puis appelle `phasesAutomatiques`. Une surexcavation
  illisible ou négative retombe sur 0,5 m. Une saisie illisible ne donne aucune phase.
- `calculDePhase(c, p, finale)` (exporté) : les listes `acier.butons` et `acier.liernes` suivent
  l'ordre des appuis. Elles sont réindexées sur les appuis en place. La phase finale renvoie le calcul
  lui-même.
- `verifierPhasage` : un refus du noyau (« Butée insuffisante… ») ne dit pas de quelle phase il vient.
  On la retrouve en recalculant les phases une à une, et le message est préfixé par « Phase k : ».
- `relire` : les phases d'un fichier sont relues avec le modèle `{H:'', appuis:[], zEau:''}`, et les
  appuis non textuels sont écartés.

**Statut** : `npx vitest run tests/app/phases-app.test.ts -t "T2"` : 6/6 passent.

## T3 : note (`app/src/note.ts`, `app/src/vue.ts`)

**Fichiers** : `app/src/note.ts`, `app/src/vue.ts` (`verificationsDe` y est déplacée et partagée avec l'écran).

**Décisions**
- Note phasée :
  - hypothèse « sans historique » ;
  - tableau « Phases de construction » dans les cas de charges ;
  - par phase, les tableaux « Efforts et mobilisation » et « Appuis », préfixés par la phase ;
  - bloc « Enveloppe des phases » ;
  - le tableau des valeurs le long de la paroi (configuration finale) est gardé ;
  - la figure d'enveloppe s'ajoute à la coupe ordinaire.
- L'acier de chaque phase est vérifié avec ses propres efforts.

**Points douteux**
- **Test d'acceptation modifié** (`tests/app/phases-app.test.ts`, test « conclusions »), avec un
  commentaire daté dans le test. Le test cherchait la phase déterminante comme la vérification au
  plus grand taux, toutes vérifications confondues. Or, dans le cas d'essai, l'équilibre vertical de
  la Phase 1 (console, fond 1,7 m) donne 2,03. C'est plus que la rotation de la phase déterminante
  (Phase 3, 0,56). La phase déterminante étant définie par la mobilisation de la butée, le test la
  cherche désormais parmi les vérifications de rotation. Le refus de la Phase 1 reste dans les
  conclusions et à l'écran.
- **À examiner (question)** : l'équilibre vertical à 2,03 pour une console peu profonde. `fond.ts`
  intègre la butée mobilisée sur toute la fiche, multipliée par le taux de mobilisation. Pour une
  fiche longue sous une fouille de 1,7 m, cette composante vers le haut dépasse largement la poussée
  vers le bas. Le résultat sort du noyau existant, inchangé : une console non phasée le donne aussi.
  Il faut décider si ce contrôle est pertinent pour une console ou s'il doit être reformulé.

**Statut** : `-t "T3"` : 4/4 passent.

## T4 : dessin (`app/src/dessin.ts`)

**Fichiers** : `app/src/dessin.ts`.

**Décisions**
- Vue d'une phase : `coupeEtDiagrammes` sur `calculDePhase`. La finale reprend exactement le calcul.
- Vue « enveloppe » :
  - coupe finale ;
  - un trait tireté « Ph. k » par fond de fouille (`<g data-phase="k">`) ;
  - zones Mmin–Mmax et, si V est coché, Vmin–Vmax (`data-role="enveloppe"`) ;
  - q et w sont sans objet dans cette vue.

**Statut** : `-t "T4"` : 2/2 passent.

## T5 : interface

**Fichiers** : `app/index.html`, `app/en/index.html`, `app/src/main.ts`, `app/src/vue.ts`,
`app/src/textes.ts`, `app/src/style.css`.

**Décisions**
- Saisie :
  - fieldset « Phases de construction » sous « Appuis » : case « Calcul phasé » ;
  - à la première activation, les phases sont générées ;
  - sous la case, la surexcavation, le tableau (fond, cases à cocher par appui, eau, retrait), la
    ligne finale grisée, et les boutons « Générer les phases » et « + phase ».
- Appuis : renommer ou retirer un appui met à jour les phases.
- Barre de la coupe : boutons « Enveloppe | Phase 1 | … ». L'export SVG prend la vue affichée.
- Résultats :
  - une carte par phase, avec sa pire vérification et le nombre de refus ;
  - puis le détail complet de la phase déterminante ;
  - un tableau des phases dans les volets (fond, appuis, fiche, Mmax, R_h par appui, taux), avec la
    ligne d'enveloppe et la phase déterminante surlignée.
- Choix fait sans validation : la carte d'une phase montre sa **pire** vérification, et pas seulement
  la rotation. Sinon le refus de la Phase 1 serait caché derrière la Phase 3.
- Bandeau « Non traités » : « phasage » est devenu « historique des phases (chaque phase est calculée
  seule) ».
- Messages de refus des phases traduits en anglais (`textes.ts`).

**Points douteux**
- Le bandeau « Non traités » cite encore le soulèvement du fond et l'équilibre vertical, qui sont
  vérifiés depuis le lot E. Il n'a pas été corrigé, car c'est hors périmètre.

**Statut**
- `npm test` : 14 fichiers, 126 tests, tous passent.
- `npm run typecheck` : sans erreur.
- `npm run build` : réussi.
- Banc (port 5200), FR et EN :
  - phasage activé, trois phases générées ;
  - vues Enveloppe et Phase k ;
  - cartes et tableau des phases ;
  - aucune erreur en console.

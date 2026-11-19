# PLAN — Paroi phasée (lot F, étape 10)

Conçu par Claude le 20/11/2026. Maquette validée par l'utilisateur :
`plan-webaedificium/maquette-parois-phasage.html`.

## 1. Spécifications

### Objectif
Calculer une paroi phase par phase : chaque phase de terrassement est vérifiée seule, par le noyau
d'équilibre limite existant. Le résultat donne l'enveloppe des phases (longueur requise, efforts
maximaux par appui, M et V extrêmes) et le détail de chaque phase.

### Décisions (utilisateur, 19-20/11/2026)
- **Phases indépendantes**, sans historique : chaque phase est un `verifierParoi` sur les données de
  la phase. Aucun cumul de déplacements.
- **Ce qui change par phase** : le fond de fouille H, les appuis en place et l'eau côté fouille. Le sol,
  la paroi (L, EI, EA), les charges, les coefficients et la norme sont communs.
- **Saisie** : un tableau de phases intermédiaires, prérempli par une génération automatique
  modifiable. La phase finale est implicite : c'est la saisie actuelle (H, tous les appuis, eau).
- **Génération** : creuser `surexcavation` (0,5 m par défaut, modifiable) sous chaque appui, pris
  dans l'ordre des profondeurs, poser l'appui, puis atteindre le fond final. Une phase dont le fond
  atteindrait ou dépasserait H n'est pas créée.
- **Eau côté fouille par défaut** : elle suit le fond de la phase (pompage), sans remonter au-dessus
  de la nappe côté terre : `zEau = max(H_phase, eau.zTerre)`. Phase finale : `eau.zFouille` saisi.
- **Console** (phase sans appui porteur) : pied encastré à 100 %, comme l'exige le noyau. Sinon,
  le degré d'encastrement saisi.
- **Sortie** : enveloppe et détail ; à l'écran, un sélecteur « Enveloppe | Phase 1 | … ».

### Interfaces publiques

`src/phases.ts` (nouveau, PUR) :
```ts
export interface Phase { nom: string; H: number; appuis: string[]; zEau: number }
export function phasesAutomatiques(d: DonneesParoi, surexcavation = 0.5): Phase[];
  // Phases nommées « Phase 1 »… ; la dernière est la finale (H = d.H, tous les appuis dans
  // l'ordre de d.appuis, zEau = d.eau.zFouille). Appuis d'une phase : ceux déjà posés, dans
  // l'ordre de d.appuis.
export function donneesDePhase(d: DonneesParoi, p: Phase): DonneesParoi;
  // { ...d, H: p.H, appuis: d.appuis filtrés, eau: { ...d.eau, zFouille: p.zEau },
  //   degreEncastrement: aucun appui porteur (effortImpose === null) ? 1 : d.degreEncastrement }.
  // Refus (Error dont le message nomme la phase, et l'appui s'il y a lieu) :
  //   appui inconnu ; appui de z >= p.H (« posé sous le fond de fouille de la phase ») ;
  //   p.H <= 0 ou p.H > d.H ; p.zEau < p.H.
export interface ResultatPhase { phase: Phase; resultat: ResultatParoi; fond: ResultatFond }
export interface EnveloppeAppui { nom: string; Rh: number; axial: number; phase: string; combinaison: string }
export interface ResultatPhases {
  phases: ResultatPhase[];
  determinante: { phase: string; combinaison: string; mobilisation: number };
  longueurRequise: { valeur: number | null; phase: string };   // max(H_phase + ficheMinimale) ; null si une fiche est null
  appuis: EnveloppeAppui[];      // |Rh| maximal par appui (dans l'ordre de d.appuis), axial de la même combinaison
  Md: number; Vd: number;        // maxima des phases
  enveloppe: { z: number[]; Mmin: number[]; Mmax: number[]; Vmin: number[]; Vmax: number[] };
    // grille régulière de 0 à d.L (pas <= L/200), courbes de toutes les combinaisons de toutes
    // les phases interpolées linéairement ; Mmin/Vmin <= 0 <= Mmax/Vmax n'est PAS imposé.
}
export function verifierPhases(d: DonneesParoi, phases: Phase[]): ResultatPhases;
  // Refus si la liste est vide ou si la dernière phase n'est pas la finale (H = d.H et tous
  // les appuis) : message contenant « finale ».
```
La phase déterminante est celle de la plus grande mobilisation (toutes combinaisons). Égalité :
la première rencontrée.

`app/src/form.ts` :
```ts
export interface SaisiePhase { H: string; appuis: string[]; zEau: string }
// Saisie gagne : phasage: boolean ; surexcavation: string ; phases: SaisiePhase[]
//   (défaut : false, '0,5', [] ; un fichier ancien se relit avec ces défauts).
// Calcul gagne : phases: Phase[] | null  (null si phasage inactif ; sinon les lignes nommées
//   « Phase k » puis la finale « Phase n+1 »).
export function phasesGenerees(s: Saisie): SaisiePhase[];   // phases intermédiaires, nombres à la française
export function verifierPhasage(c: Calcul): ResultatPhases | null;
// verifier(c) reste le calcul de la configuration finale (inchangé).
```
Les refus de lecture nomment la phase (« Phase 2 : … »).

`app/src/note.ts` : quand `calcul.phases !== null` :
- hypothèses : une ligne contenant « sans historique » (phases indépendantes en équilibre limite) ;
- cas de charges : un tableau titré « Phases… » (fond, appuis, eau) ;
- calculs : un bloc par phase (efforts par combinaison, appuis, fiche) puis un bloc « Enveloppe »
  (longueur requise et sa phase, effort maximal de chaque appui avec sa phase, Md, Vd) ;
- conclusions : chaque vérification de chaque phase (rotation, soulèvement, équilibre vertical, acier),
  nom préfixé par `${phase.nom} · ` ; la déterminante en découle ;
- figure : l'enveloppe (`dessinPhasage(..., 'enveloppe', ...)`).
Sans phasage, la note ne change pas.

`app/src/dessin.ts` :
```ts
export function dessinPhasage(c: Calcul, rp: ResultatPhases, vue: 'enveloppe' | number, o: OptionsDessin): string;
// number = indice de phase (0 = première) : coupeEtDiagrammes sur le calcul de cette phase
//   (donnees = donneesDePhase) ; pour la finale, identique à coupeEtDiagrammes(c, verifier(c), o).
// 'enveloppe' : coupe avec un trait par fond de fouille (attribut data-phase="k", k à partir de 1),
//   zone des moments entre Mmin et Mmax (élément portant data-role="enveloppe"), V si o.V.
```

`app/index.html`, `app/en/index.html`, `app/src/main.ts`, `app/src/vue.ts`, `app/src/textes.ts` :
- fieldset « Phases de construction » sous « Appuis » : case « Calcul phasé », champ surexcavation,
  tableau (Ph., Fond (m), Appuis = cases à cocher par appui, Eau (m), supprimer), ligne finale
  grisée, boutons « Générer les phases » et « Ajouter une phase » ;
- barre des diagrammes : boutons « Enveloppe », « Phase 1 »… (visibles si phasage) ;
- résultats : cartes de rotation de la phase déterminante, tableau des phases (fond, appuis, fiche,
  Mmax, réaction de chaque appui, taux) avec ligne d'enveloppe et phase déterminante surlignée ;
- tout en français et en anglais, comme le reste de l'outil ;
- feuilles de calcul et fichier : la saisie complète (phases comprises) est enregistrée.

### Hors périmètre
Historique des déplacements (ressorts), charges propres à une phase, encastrement propre à une
phase, phases de démontage d'appuis, rabattement calculé.

## 2. Tâches

| Tâche | Fichiers | Dépend de | Tests |
|---|---|---|---|
| T1 noyau | `src/phases.ts` | — | `npx vitest run tests/phases.test.ts` |
| T2 saisie | `app/src/form.ts` | T1 | `npx vitest run tests/app/phases-app.test.ts -t "T2"` |
| T3 note | `app/src/note.ts`, `app/src/vue.ts` (textes) | T2 | `npx vitest run tests/app/phases-app.test.ts -t "T3"` |
| T4 dessin | `app/src/dessin.ts` | T2 | `npx vitest run tests/app/phases-app.test.ts -t "T4"` |
| T5 interface | `app/index.html`, `app/en/index.html`, `app/src/main.ts`, `app/src/vue.ts`, `app/src/textes.ts`, `app/src/style.css` | T2-T4 | `npm test`, `npm run typecheck`, `npm run build` ; contrôle au banc par Claude |

Résultat attendu à la fin : `npm test` tout vert (98 tests existants + les nouveaux),
`npm run typecheck` sans erreur, `npm run build` réussi.

## 3. Règles pour l'exécutant
- Ne jamais modifier `tests/phases.test.ts`, `tests/app/phases-app.test.ts` ni aucun test existant.
  Un test qui paraît faux : s'arrêter et le signaler dans `HANDOFF.md`.
- Ne pas toucher au calcul de `src/parois.ts` ni de `src/fond.ts` (le phasage les appelle).
- Pas de valeur numérique inventée : aucun coefficient nouveau.
- Décisions laissées à l'exécutant : présentation exacte des tableaux et des cartes, dans le style
  de l'outil ; noms internes.
- Interdit : changer le format des fichiers autrement qu'en ajoutant les trois champs ; changer
  `verifier(c)`.
- Consigner chaque tâche dans `HANDOFF.md` (fichiers, décisions, points douteux, tests).

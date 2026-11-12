# Parois : plan du noyau V1

Rédigé le 2026-11-09. Maquette : `plan-webaedificium/maquette-parois.html`.

## Objectif

Paroi encastrée (palplanches, berlinoise, paroi moulée), cible finale au niveau de GGU-Retain. La V1 fournit le
noyau : `verifierParoi(d: DonneesParoi): ResultatParoi` dans `src/parois.ts`.

## Périmètre V1

- Portique 2D (paroi, appuis inclinés avec EA) résolu par éléments de poutre ; q, V, M, N, w.
- Pied libre, encastré (fiche majorée de 20 %, méthode de Blum) ou degré intermédiaire (interpolation linéaire).
- Butée mobilisée au prorata pour la fiche réelle ; recherche de fiche minimale.
- Couches libres, δ/φ par couche, Ka et Kp imposables, part de K0, redistributions (rectangle, trapèze, triangles, polygone).
- Charges : réparties, bandes (Boussinesq, doublée pour paroi rigide, ou coin de poussée Kah·q·b réparti entre a·tan φ et (a+b)·tan ϑa), forces, moments, pressions imposées.
- Eau : hydrostatique ou écoulement au pied à gradient uniforme.
- Normes : EN 1997-3:2025 tableau 7.2, approches (a)+(b) et (d) ; EN 1997-1:2004 DA1, DA2, DA3 ; ANB 2022.
- Coefficients modifiables, signalés dans le résultat. Liernes : T·a²/10 ou T·a²/8.

## Choix déclarés

- Annexe D, D.3.2 pour Ka et Kp. K0 = 1 − sin φ.
- Redistribution : terres et surcharges réparties seulement ; l'eau, les bandes et les pressions imposées ne sont pas redistribuées.
- Efforts d'un degré intermédiaire : interpolés entre les deux limites.
- γRe = 1,4 en DA2 (tableau A.13 de l'EN 1997-1:2004, à confronter au texte).

## Hors V1

Ressorts, phasage, risbermes, soulèvement du fond, renard vérifié, équilibre vertical, charges de bloc et linéiques,
EAB et EAU, dimensionnement acier (réutilisera le moteur de `sections-ec3`).

## Tests

`tests/attendus.py` produit les attendus par intégration directe et méthode des forces.
`tests/parois.test.ts` : `lancer.mjs .` et `typecheck.mjs .`.

## Lot acier (12/11/2026) : profils de berlinoise, butons et liernes (EN 1993-1-1 par sections-ec3)

Objectif : vérifier en acier les profilés en I de berlinoise, les butons et les liernes avec le moteur de `sections-ec3`
(dépendance `github:henri421/sections-ec3#v0.3.0`, résolue en local par le banc).

T1 (fait par la séance Claude) : `src/acier.ts`, `verifierAcier(d, r, a): ElementAcier[]`. Tests : `tests/acier.test.ts`.
Interface publique à utiliser telle quelle : `DonneesAcier { paroi: {profil, nuance, entraxe} | null ; butons: (ProfilAcier|null)[] ; liernes: (ProfilAcier|null)[] }`,
`ElementAcier { type: 'paroi'|'buton'|'lierne' ; nom ; profil ; nuance ; N ; M ; V ; longueur ; resultat ; taux: number|null ; erreur: 'profil'|'longueur'|null }`.

### T2 : saisie et écran (exécutant)

Fichiers : `app/src/form.ts`, `app/src/vue.ts`, `app/index.html`, `app/en/index.html`. Ne pas toucher `src/`.
- `Saisie` : ajouter `profilParoi` (défaut ''), `nuance` (défaut 'S235'), `entraxeProfils` (défaut '2,5').
  `SaisieAppui` : ajouter `profilButon` et `profilLierne` (défaut '' ; aussi dans `nouvelAppui`).
- `Calcul` : ajouter `acier: DonneesAcier`. `lireSaisie` le remplit : `paroi` null si `profilParoi` vide après trim, sinon
  `{ profil, nuance, entraxe }` ; entraxe lu par `nb` (libellé T('Entraxe des profilés', 'Pile spacing')) et refus
  T('L’entraxe des profilés doit être strictement positif.', 'The pile spacing must be strictly positive.') si <= 0.
  Nuance hors de S235, S275, S355, S420, S460 : 'S235'. `butons[i]` et `liernes[i]` : null si le champ est vide, sinon
  `{ profil, nuance }` avec la nuance commune.
- `relire` : les fichiers sans ces champs prennent les défauts (vérifier que `fusion` les garde).
- Pages : dans le fieldset « Paroi et excavation », après le champ EA, trois lignes `label.ligne` :
  « Profilé de berlinoise » (input text `data-champ="profilParoi"`, placeholder « aucun »), « Nuance d’acier »
  (select `data-champ="nuance"`, options exactement `<option value="S235">S235</option>` ... S460), « Entraxe des profilés (m) »
  (input `data-champ="entraxeProfils"`). En anglais : « Soldier pile section », placeholder « none », « Steel grade », « Pile spacing (m) ».
- `appuisHtml` : pour chaque appui, deux `champ(...)` de plus, toujours affichés : T('Profilé du buton', 'Strut section') sous
  'profilButon' et T('Profilé de la lierne', 'Waler section') sous 'profilLierne', indice T('aucun', 'none').
- `verdictsHtml` : après le groupe « Efforts à reprendre », si `verifierAcier(c.donnees, r, c.acier)` n'est pas vide, un groupe
  T('Acier, EN 1993-1-1', 'Steel, EN 1993-1-1') et une carte par élément. Donner à `carteTaux` un paramètre pour
  l'attribut `data-verification` ('rotation' pour l'existant, 'acier' ici). Titre : paroi T('Profilés de berlinoise', 'Soldier piles'),
  buton `${T('Buton', 'Strut')} ${nom}`, lierne `${T('Lierne', 'Waler')} ${nom}` ; clause '6.2, 6.3' ; taux = `taux` (Infinity si null).
  Corps : `${profil} ${nuance} : N = .. kN ; M = .. kN·m ; V = .. kN ; L = .. m.` (en anglais, `: ` et `; `), nombres par `aff`.
  Erreur 'profil' : T('Profilé absent du catalogue.', 'Section not in the catalogue.') ; 'longueur' :
  T('Longueur libre du buton à renseigner.', 'Free length of the strut required.').
- `hypotheses()` : une ligne de plus, en français et en anglais, qui reprend l'en-tête de `src/acier.ts` (efforts retenus,
  longueurs, V = 0,6 ou 0,5 R_h·a, C1 = 1, deversement non empêché, poids propre négligé) et cite EN 1993-1-1.
  En anglais, n'employer aucun des mots de la regex FRANCAIS de `tests/app/acier.test.ts`.
Tests : `ELECTRON_RUN_AS_NODE=1 Code.exe ../_banc-local/lancer.mjs . acier` : le bloc « T2 » de `tests/app/acier.test.ts` passe
(8 tests), puis la suite complète passe et `typecheck.mjs .` donne 0 erreur.

### T3 : note et anglais (exécutant)

Fichiers : `app/src/note.ts`, et `app/src/textes.ts` si une phrase doit être traduite. Ne pas toucher `src/`.
- `noteDuCalcul` : pour chaque élément de `verifierAcier(...)`, une vérification `{ nom: `${titre}, ${profil} ${nuance}`,
  clause: 'EN 1993-1-1, 6.2 ; 6.3', taux: taux ?? NaN, ok: taux !== null && taux <= 1 }` (titre identique à l'écran).
- Section `calculs` : un tableau titre T('Acier', 'Steel'), en-têtes [T('Élément', 'Element'), T('Profilé', 'Section'),
  'N (kN)', 'M (kN·m)', 'V (kN)', 'L (m)', T('Taux', 'Ratio')], une ligne par élément (taux par `tauxAffiche`, '—' si erreur).
Tests : bloc « T3 » de `tests/app/acier.test.ts` (3 tests), suite complète et typecheck.

### Interdits à l'exécutant

Modifier `src/`, les tests, `package.json`, le lockfile ; parcourir d'autres dépôts ; pousser.

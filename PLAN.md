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
- Charges : réparties, bandes (Boussinesq, doublée pour paroi rigide), forces, moments, pressions imposées.
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

# parois

Vérification d'une **paroi de soutènement encastrée** (palplanches, berlinoise, paroi moulée) par **équilibre
limite** selon l'**EN 1997**, dans ses **deux générations**. Paroi et appuis sont résolus comme un portique plan.
Un bouton bascule d'une génération à l'autre sans rien ressaisir.

Fait partie de la suite [Aedificium web](https://henri421.github.io/WebAedificium/).
Page publiée : <https://henri421.github.io/parois/>.

> **Aide au calcul. L'outil constate, il ne prescrit pas.** Valeurs recommandées des normes. La 2ᵉ génération
> n'est applicable qu'une fois son annexe nationale publiée. **Les valeurs ont été comparées à un calcul
> indépendant, pas encore à un logiciel du commerce.** La vérification finale incombe à l'ingénieur du projet.

## Ce que l'outil rend

- **Butée mobilisée** par combinaison et **fiche minimale**.
- **Diagrammes** q, V, M, et déplacement w indicatif, le long de la paroi.
- **Efforts** dans la paroi, les appuis (tirants, butons, inclinés, efforts imposés) et les liernes.
- **Sorties** : note de calcul HTML, coupe (SVG), résultats (CSV), saisie enregistrée (JSON).

## Hors périmètre de cette version

Phasage et interaction sol-structure, soulèvement du fond et renard, équilibre vertical, résistance des tirants,
de la paroi et des liernes, stabilité générale, répartitions EAB et EAU.

## Développement

```bash
npm ci
npm test
npm run typecheck
npm run dev
```

Les attendus des tests viennent de `tests/attendus.py`, calcul indépendant sans éléments finis.

Licence : voir `LICENSE`. Les textes des normes ne figurent pas dans ce dépôt.

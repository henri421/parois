# Validation — palplanche ancrée, exemple A.7 du rapport JRC EUR 26227 EN (2013)

**Source externe.** A. J. Bond, B. Schuppener, G. Scarpelli, T. L. L. Orr, *Eurocode 7: Geotechnical
Design — Worked examples*, rapport JRC EUR 26227 EN, 2013, annexe A.7 « Anchored sheet pile wall ».
Exemples du workshop EC7 de Dublin (juin 2013), publiés par le Centre commun de recherche de la
Commission européenne. Les valeurs attendues sont celles du rapport ; elles n'ont pas été recalculées
de notre côté.

Cas figé par `tests/validation-jrc-a7.test.ts`.

## Données (rapport)

- Hauteur retenue de calcul H_d = 8,5 m (8,0 m plus l'excavation imprévue de 0,5 m).
- Sable dense sec : γ = 20 kN/m³, φ'_k = 38°, c' = 0 ; pas de nappe, pas de surcharge (q_k = 0).
- Frottement paroi-sol δ = 20° (0,67 φ_cv,d avec φ_cv = 30°), en poussée et en butée.
- Un tirant en tête, incliné à 30° sur l'horizontale ; pied libre ; coefficients de l'annexe C.
- Position du tirant : non écrite dans le texte (figure A.7.1). Les moments du rapport la placent
  en tête : en DA2*, P_a = 310 kN/m avec un bras de 2(H_d + d)/3 = 7,03 m donne M_dst = 2 180 kN·m/m,
  la valeur publiée ; P_p = 221,8 kN/m avec un bras de H_d + 2d/3 = 9,87 m donne M_stb = 2 188 kN·m/m.

## Saisie dans l'outil

H = 8,5 m ; une couche φ = 38°, γ = γ_sat = 20 ; nappe sous la paroi ; tirant à z = 0, 30°,
entraxe 1 m, rigide ; encastrement 0 % ; part de K₀ nulle ; sans redistribution ; EN 1997-1:2004,
valeurs recommandées. L'outil exprime δ par k = tan δ / tan φ_d : k = tan 20° / tan 38° = 0,466 pour
DA2 et DA1-1, k = tan 20° / tan 32° = 0,582 pour DA1-2 (φ_d = 32°), pour garder δ = 20°.

## Résultats

| Grandeur | Rapport JRC | Outil | Écart |
| --- | --- | --- | --- |
| K_a,h (φ = 38°, δ = 20°) | 0,21 | 0,2063 | arrondi du rapport |
| K_p,h (φ = 38°, δ = 20°) | 7,39 | 7,386 | < 0,1 % |
| K_a,h (φ_d = 32°, δ = 20°) | 0,26 | 0,2636 | arrondi du rapport |
| K_p,h (φ_d = 32°, δ = 20°) | 5,18 | 5,182 | < 0,1 % |
| **DA2\*** fiche d | 2,05 m | 2,045 m | −0,2 % |
| DA2\* effort axial du tirant F_a,Ed | 101,9 kN/m | 102,7 kN/m | +0,8 % |
| DA2\* effort horizontal P_Ed | 88,2 kN/m | 89,0 kN/m | +0,9 % |
| DA2\* moment maximal M_Ed | 331 kN·m/m | 335 kN·m/m | +1,3 % |
| DA2\* profondeur du moment maximal | 5,63 m | 5,65 m | +0,4 % |
| **DA1-2** fiche d | 2,01 m | 1,997 m | −0,6 % |
| DA1-2 effort horizontal P_Ed | 81,7 kN/m | 83,7 kN/m | +2,4 % |
| DA1-2 moment maximal M_Ed | 303 kN·m/m | 314 kN·m/m | +3,8 % |

## Explication des écarts

- **Fiche arrondie.** Le rapport arrondit d au centimètre supérieur et laisse un déséquilibre des
  moments de 0,4 % (DA2\*) et 1 % (DA1-2) en faveur de la stabilité ; l'outil cherche d à
  l'équilibre exact. Une fiche plus longue mobilise plus de butée et réduit P_Ed : avec d = 2,01 m,
  les mêmes formules redonnent P_Ed = 81,8 kN/m (rapport : 81,7) ; avec la fiche de l'outil,
  1,997 m, elles donnent 83,7 kN/m, la valeur de l'outil.
- **Moment.** Les formules du rapport appliquées au P_Ed de l'outil redonnent son moment
  (DA1-2 : z = 5,63 m, M = 314 kN·m/m). L'écart sur M vient donc entièrement de l'arrondi de d.
- **DA1-1 non comparé.** Le rapport y applique le principe de la source unique : la butée est
  multipliée par γ_G,fav = 1,35, comme la poussée. L'outil ne pondère pas la butée en DA1-1
  (γ_R;e = 1, butée caractéristique) : c'est un choix de modèle différent, pas une erreur, et DA1-2
  gouverne la fiche dans les deux calculs. Les valeurs DA1-1 du rapport ne sont de plus pas
  cohérentes entre elles (M_dst = 1 790 kN·m/m ne se retrouve pas avec d = 1,11 m).

## Conclusion

Coefficients de poussée et de butée de l'annexe C, fiche minimale et efforts retrouvés ; écarts
expliqués par l'arrondi de la fiche dans le rapport. **Validé sur ce cas** (DA2\* et DA1-2,
paroi ancrée en tête, pied libre, sable sec).

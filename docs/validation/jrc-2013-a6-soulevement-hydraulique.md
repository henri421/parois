# Validation — soulèvement hydraulique au pied, exemple A.6.2 du rapport JRC EUR 26227 EN (2013)

**Source externe.** A. J. Bond, B. Schuppener, G. Scarpelli, T. L. L. Orr, *Eurocode 7: Geotechnical
Design — Worked examples*, rapport JRC EUR 26227 EN, 2013, annexe A.6.2 « Verification against
failure of hydraulic heave », figure A.6.5. Exemples du workshop EC7 de Dublin (juin 2013), publiés
par le Centre commun de recherche de la Commission européenne. Les valeurs attendues sont celles du
rapport.

Cas figé par `tests/validation-jrc-a6.test.ts`.

## Données (rapport, figure A.6.5)

- Palplanche ; eau libre côté terre, h = 4,4 m de perte de charge entre les deux niveaux d'eau.
- h′ = 1,4 m de sol côté terre au-dessus du fond de fouille ; fiche t = 6,60 m ; eau côté fouille au
  niveau du fond.
- γ_sat = 20 kN/m³, γ′ = 10 kN/m³, γ_w = 10 kN/m³.
- Charge résiduelle au pied par la formule approchée de l'EAU :
  h_r = h / (1 + ∛(h′/t + 1)) = 2,13 m ; gradient dans la colonne i = h_r / t = 0,32.

## Saisie dans l'outil

H = 1,4 m, L = 8,0 m ; une couche γ = γ_sat = 20 ; z_terre = −3,0 m (eau 3,0 m au-dessus du
terrain retenu), z_fouille = 1,4 m, écoulement ; EN 1997-1:2004, valeurs recommandées, et
EN 1997-1:2024.

## Résultats

| Grandeur | Rapport JRC | Outil avant | Outil corrigé |
| --- | --- | --- | --- |
| Gradient dans la colonne | 0,32 | 0,25 | 0,3226 |
| Surpression au pied Δu = γ_w h_r | 21,3 kPa | 16,5 kPa | 21,29 kPa |
| Contrainte effective σ′ = γ′ t | 66 kPa | 66 kPa | 66 kPa |
| (2.9b) γ_G,dst S / γ_G,stb G′ | 4,32 / 9,0 = 0,48 | 0,375 | 0,484 |
| (2.9a) u_k total au pied | 87,3 kPa | — | 87,3 kPa |

## Écart trouvé et correction

L'outil calculait la surpression au pied avec le gradient uniforme qu'il emploie pour les pressions
d'eau sur la paroi : i = h / longueur du chemin autour du pied = 4,4 / 17,6 = 0,25. Ce gradient moyen
ignore la concentration de la perte de charge côté fouille : il sous-estimait la surpression de 22 %,
du côté de l'insécurité. Depuis cette validation, le HYD prend h_r de l'EAU, avec
h′ = z_fouille − max(z_terre, 0), chemin dans le sol côté terre au-dessus du niveau d'eau côté fouille.
Les pressions d'eau sur la paroi gardent le gradient uniforme, simplification courante pour les
efforts. La formule vaut pour un sol homogène et une fouille large ; une fouille étroite ou un sol
stratifié demandent un réseau d'écoulement.

## Conclusion

Après correction, surpression, contrainte stabilisatrice et taux retrouvés. **Validé sur ce cas**
(sol homogène, fouille large, deux générations).

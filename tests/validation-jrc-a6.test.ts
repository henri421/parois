// Validation externe (audit R1, lot B) : rapport JRC EUR 26227 EN (2013), exemple A.6.2, soulevement
// hydraulique au pied d'une palplanche. Attendus du rapport ; voir docs/validation/jrc-2013-a6-soulevement-hydraulique.md.
import { describe, expect, it } from 'vitest';
import { chargeAuPied, verifierFond } from '../src/fond';
import { verifierParoi, type DonneesParoi } from '../src/parois';

/** Eau libre 3,0 m au-dessus du terrain retenu, h′ = 1,4 m de sol au-dessus du fond, fiche t = 6,60 m. */
function donnees(generation: 1 | 2): DonneesParoi {
  return {
    H: 1.4, L: 8.0, EI: 50000, EA: 1e7,
    couches: [{ nom: 'Sable', h: 40, gamma: 20, gammaSat: 20, phi: 30, c: 0, kDeltaA: 0, kDeltaP: 0, KaImpose: null, KpImpose: null }],
    eau: { zTerre: -3.0, zFouille: 1.4, ecoulement: true },
    charges: [],
    appuis: [],
    degreEncastrement: 1, partK0: 0, redistribution: { forme: 'aucune' },
    norme: generation === 1
      ? { generation: 1, profil: 'recommande', approche: 'DA2' }
      : { generation: 2, cc: 'CC2', approche: 'a+b' },
  };
}

const proche = (outil: number, rapport: number, tolerance: number): void => {
  expect(Math.abs(outil - rapport) / rapport).toBeLessThanOrEqual(tolerance);
};

describe('JRC 2013, A.6.2 : soulevement hydraulique au pied', () => {
  it('charge residuelle au pied h_r = 2,13 m (formule de l EAU)', () => {
    proche(chargeAuPied(4.4, 1.4, 6.6), 2.13, 0.002);
  });

  it('1re generation, (2.9b) : 1,35 x 0,32 x 10 = 4,32 <= 0,90 x 10 = 9,0', () => {
    const d = donnees(1);
    const h = verifierFond(d, verifierParoi(d)).hyd!;
    proche(h.gradient, 0.32, 0.01);
    proche(h.du, 21.3, 0.002);
    proche(h.sigma, 66, 1e-9);
    proche(h.taux, 4.32 / 9.0, 0.01);
    // Forme (2.9a) du rapport, totale : u = γw.t + Δu = 87,3 ; σ = 132 ; 117,9 <= 118,8.
    proche(10 * 6.6 + h.du, 87.3, 0.001);
  });

  it('2e generation : meme surpression, comparee a 0,67 σ′', () => {
    const d = donnees(2);
    const h = verifierFond(d, verifierParoi(d)).hyd!;
    proche(h.du, 21.3, 0.002);
    proche(h.taux, 21.3 / (0.67 * 66), 0.002);
  });
});

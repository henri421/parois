// Validation externe (audit R1, lot B) : rapport JRC EUR 26227 EN (2013), exemple A.7, palplanche
// ancree. Attendus du rapport ; ecarts expliques dans docs/validation/jrc-2013-a7-palplanche-ancree.md.
import { describe, expect, it } from 'vitest';
import { coefficientKq, verifierParoi, type DonneesParoi } from '../src/parois';

const rad = (d: number): number => (d * Math.PI) / 180;
const kDelta = (phiD: number): number => Math.tan(rad(20)) / Math.tan(rad(phiD));

function donnees(L: number, approche: 'DA1' | 'DA2', k: number): DonneesParoi {
  return {
    H: 8.5, L, EI: 50000, EA: 1e7,
    couches: [{ nom: 'Sable dense', h: 40, gamma: 20, gammaSat: 20, phi: 38, c: 0, kDeltaA: k, kDeltaP: k, KaImpose: null, KpImpose: null }],
    eau: { zTerre: 100, zFouille: 100, ecoulement: false },
    charges: [],
    appuis: [{ nom: 'Tirant', type: 'tirant', z: 0, inclinaison: 30, entraxe: 1, EA: null, longueur: null, effortImpose: null, lierne: null }],
    degreEncastrement: 0, partK0: 0, redistribution: { forme: 'aucune' },
    norme: { generation: 1, profil: 'recommande', approche },
  };
}

/** Fiche minimale, puis efforts a L = H + fiche. */
function calcul(approche: 'DA1' | 'DA2', k: number, combinaison: number) {
  const t = verifierParoi(donnees(20, approche, k)).combinaisons[combinaison].ficheMinimale ?? NaN;
  const c = verifierParoi(donnees(8.5 + t + 1e-6, approche, k)).combinaisons[combinaison];
  return { t, Rh: c.appuis[0].Rh, Fa: c.appuis[0].axial, M: c.Mmax };
}

/** Ecart relatif au rapport, borne. */
const proche = (outil: number, rapport: number, tolerance: number): void => {
  expect(Math.abs(outil - rapport) / rapport).toBeLessThanOrEqual(tolerance);
};

describe('JRC 2013, A.7 : palplanche ancree en tete, sable dense sec', () => {
  it('coefficients de l annexe C (delta = 20 degres)', () => {
    const d = rad(20);
    proche(coefficientKq(rad(38), -d, false) * Math.cos(d), 7.39, 0.002);
    proche(coefficientKq(rad(32), -d, false) * Math.cos(d), 5.18, 0.002);
    proche(coefficientKq(rad(38), d, true) * Math.cos(d), 0.21, 0.025);
    proche(coefficientKq(rad(32), d, true) * Math.cos(d), 0.26, 0.02);
  });

  it('DA2* : fiche 2,05 m, tirant 101,9 kN/m, moment 331 kN.m/m', () => {
    const r = calcul('DA2', kDelta(38), 0);
    proche(r.t, 2.05, 0.005);
    proche(r.Fa, 101.9, 0.01);
    proche(r.Rh, 88.2, 0.01);
    proche(r.M, 331, 0.015);
  });

  it('DA1-2 : fiche 2,01 m ; efforts au-dessus du rapport, qui arrondit la fiche', () => {
    const r = calcul('DA1', kDelta(32), 1);
    proche(r.t, 2.01, 0.01);
    proche(r.Rh, 81.7, 0.03);
    proche(r.M, 303, 0.045);
    // L ecart va dans le sens attendu : fiche exacte plus courte, poussee nette plus forte.
    expect(r.t).toBeLessThan(2.01);
    expect(r.Rh).toBeGreaterThan(81.7);
  });
});

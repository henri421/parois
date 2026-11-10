// Tests d'acceptation de la charge en bande « coin de poussee » (repartition classique de la
// poussee d'une bande, Kah.q.b etale entre a.tan(phi) et (a+b).tan(theta_a)). A ne pas modifier.
import { describe, expect, it } from 'vitest';
import { angleGlissementActif, coefficientKq, pressionBandeCoin, verifierParoi, type DonneesParoi } from '../src/parois';

const rad = (d: number): number => (d * Math.PI) / 180;
const proche = (x: number, attendu: number, rel = 1e-3) =>
  expect(Math.abs(x - attendu) / Math.abs(attendu)).toBeLessThanOrEqual(rel);

describe('coin de poussee', () => {
  it('angle du plan de glissement de Coulomb', () => {
    // delta = 0 : Rankine, 45 + phi/2.
    proche(angleGlissementActif(rad(35), 0), rad(62.5), 1e-6);
    // delta = 2/3 phi : maximum de cot(t).sin(t - phi)/cos(t - phi - delta), obtenu par balayage a 0,01 deg.
    proche(angleGlissementActif(rad(35), rad(35 * 2 / 3)), rad(58.94), 2e-4);
  });

  it('pression uniforme entre les deux plans, resultante Kah.q.b', () => {
    const t = rad(60);
    const z1 = 1 * Math.tan(rad(30));
    const z2 = 3 * Math.tan(t);
    const e = (0.25 * 20 * 2) / (z2 - z1);
    expect(pressionBandeCoin(20, 1, 2, z1 - 0.01, 0.25, rad(30), t)).toBe(0);
    proche(pressionBandeCoin(20, 1, 2, z1 + 0.01, 0.25, rad(30), t), e, 1e-9);
    proche(pressionBandeCoin(20, 1, 2, z2 - 0.01, 0.25, rad(30), t), e, 1e-9);
    expect(pressionBandeCoin(20, 1, 2, z2 + 0.01, 0.25, rad(30), t)).toBe(0);
  });

  it('dans la paroi : identique a la pression imposee equivalente', () => {
    const base = (): DonneesParoi => ({
      H: 5, L: 8, EI: 80000, EA: 3e6,
      couches: [{ nom: 'Sable', h: 30, gamma: 18, gammaSat: 21, phi: 35, c: 0, kDeltaA: 2 / 3, kDeltaP: 0.5, KaImpose: null, KpImpose: null }],
      eau: { zTerre: 5, zFouille: 5, ecoulement: false },
      charges: [],
      appuis: [{ nom: 'A', type: 'tirant', z: 0.5, inclinaison: 10, entraxe: 2, EA: null, longueur: null, effortImpose: null, lierne: null }],
      degreEncastrement: 0, partK0: 0, redistribution: { forme: 'aucune' },
      norme: { generation: 1, profil: 'recommande', approche: 'DA2' },
    });
    const da = rad(35 * 2 / 3);
    const Kah = coefficientKq(rad(35), da, true) * Math.cos(da);
    const z1 = 1 * Math.tan(rad(35));
    const z2 = 3.25 * Math.tan(rad(58.94));
    const coin = base();
    coin.charges = [{ type: 'bande', nature: 'permanente', q: 30, a: 1, b: 2.25, rigide: false, modele: 'coin' }];
    const imp = base();
    imp.charges = [{ type: 'pression', nature: 'permanente', z1, z2, p1: (Kah * 30 * 2.25) / (z2 - z1), p2: (Kah * 30 * 2.25) / (z2 - z1) }];
    const rc = verifierParoi(coin).combinaisons[0];
    const ri = verifierParoi(imp).combinaisons[0];
    proche(rc.Mmax, ri.Mmax, 2e-3);
    proche(rc.appuis[0].Rh, ri.appuis[0].Rh, 2e-3);
    proche(rc.mobilisation, ri.mobilisation, 2e-3);
  });
});

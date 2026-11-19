// Tests d'acceptation du fond de fouille et de l'equilibre vertical (lot fond, PLAN.md). A ne pas modifier.
// HYD modifie par Claude le 19/11/2026 (validation JRC A.6.2) : h_r de l'EAU au lieu du gradient uniforme.
// Attendus calcules a la main (HYD, Bjerrum et Eide) ou par formule fermee (composantes verticales
// d'un sable homogene sec : Ka.sin(δa).γL²/2 et Kp.sin(δp).γD²/2).
import { describe, expect, it } from 'vitest';
import { facteurNc, verifierFond } from '../src/fond';
import { coefficientKq, verifierParoi, type DonneesParoi } from '../src/parois';

const proche = (x: number, attendu: number, rel = 1e-6) =>
  expect(Math.abs(x - attendu)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(attendu)));

const sable = (h = 30, phi = 30) =>
  ({ nom: 'Sable', h, gamma: 18, gammaSat: 20, phi, c: 0, kDeltaA: 2 / 3, kDeltaP: 0.5, KaImpose: null, KpImpose: null });

function base(): DonneesParoi {
  return {
    H: 5, L: 10, EI: 1e5, EA: 5e6,
    couches: [sable()],
    eau: { zTerre: 2, zFouille: 5, ecoulement: true },
    charges: [],
    appuis: [{ nom: 'T', type: 'tirant', z: 1, inclinaison: 20, entraxe: 2.5, EA: null, longueur: null, effortImpose: null, lierne: null }],
    degreEncastrement: 0, partK0: 0, redistribution: { forme: 'aucune' },
    norme: { generation: 2, cc: 'CC2', approche: 'a+b' },
  };
}

describe('soulevement hydraulique au pied', () => {
  it('2e generation : Δu ≤ 0,67 σ′v0', () => {
    const d = base();
    const h = verifierFond(d, verifierParoi(d)).hyd!;
    // h = 5 − 2 = 3, h′ = 5 − 2 = 3, t = 10 − 5 = 5 : h_r = 3 / (1 + ∛1,6) ; Δu = 10.h_r ; σ′ = 20.5 − 10.5 = 50.
    const hr = 3 / (1 + Math.cbrt(1.6));
    proche(h.gradient, hr / 5);
    proche(h.du, 10 * hr);
    proche(h.sigma, 50);
    proche(h.taux, (10 * hr) / (0.67 * 50));
  });
  it('1re generation : 1,35 Δu ≤ 0,90 σ′v0', () => {
    const d = base();
    d.norme = { generation: 1, profil: 'recommande', approche: 'DA2' };
    proche(verifierFond(d, verifierParoi(d)).hyd!.taux, (1.35 * 10 * (3 / (1 + Math.cbrt(1.6)))) / (0.9 * 50));
  });
  it('sans ecoulement : rien', () => {
    const d = base();
    d.eau.ecoulement = false;
    expect(verifierFond(d, verifierParoi(d)).hyd).toBeNull();
  });
});

describe('soulevement du fond en sol fin (Bjerrum et Eide)', () => {
  it('facteur Nc, D.25 et D.26', () => {
    proche(facteurNc(6, 10, null), 5 * 1.12);
    proche(facteurNc(6, 10, 20), 5 * 1.12 * 1.1);
    proche(facteurNc(30, 10, null), 7.5);
  });

  const argile = (): DonneesParoi => {
    const d = base();
    d.H = 6;
    d.L = 14;
    d.couches = [{ ...sable(2), gamma: 18 }, { nom: 'Argile', h: 30, gamma: 19, gammaSat: 19, phi: 0, c: 40, kDeltaA: 0.5, kDeltaP: 0.5, KaImpose: null, KpImpose: null }];
    d.eau = { zTerre: 40, zFouille: 40, ecoulement: false };
    d.charges = [{ type: 'repartie', nature: 'variable', q: 10 }];
    d.norme = { generation: 1, profil: 'recommande', approche: 'DA2' };
    d.fouille = { B: 10, longueur: null };
    return d;
  };

  it('DA2 : (1,35.(18.2 + 19.4) + 1,5.10) / (5,6.40 / 1,4)', () => {
    const d = argile();
    const f = verifierFond(d, verifierParoi(d)).fond;
    expect(f.applicable).toBe(true);
    if (!f.applicable) return;
    expect(f.combinaisons).toHaveLength(1);
    proche(f.combinaisons[0].taux, (1.35 * 112 + 1.5 * 10) / ((5.6 * 40) / 1.4));
  });
  it('non applicable : sol draine au fond, ou largeur non saisie', () => {
    const d = base();
    d.fouille = { B: 10, longueur: null };
    expect(verifierFond(d, verifierParoi(d)).fond).toEqual({ applicable: false, motif: 'draine' });
    const a = argile();
    a.fouille = undefined;
    expect(verifierFond(a, verifierParoi(a)).fond).toEqual({ applicable: false, motif: 'largeur' });
  });
});

describe('equilibre vertical', () => {
  const sec = (): DonneesParoi => {
    const d = base();
    d.eau = { zTerre: 40, zFouille: 40, ecoulement: false };
    d.norme = { generation: 1, profil: 'recommande', approche: 'DA2' };
    return d;
  };

  it('composantes verticales : formules fermees du sable sec', () => {
    const d = sec();
    const r = verifierParoi(d);
    const v = verifierFond(d, r).vertical;
    expect(v).toHaveLength(1);
    const phi = (30 * Math.PI) / 180;
    const da = Math.atan((2 / 3) * Math.tan(phi));
    const dp = Math.atan(0.5 * Math.tan(phi));
    const Ka = coefficientKq(phi, da, true);
    const Kp = coefficientKq(phi, -dp, false);
    proche(v[0].pousseeBas, 1.35 * Ka * Math.sin(da) * 18 * 100 / 2, 1e-5);
    proche(v[0].buteeHaut, (r.combinaisons[0].mobilisation / 1.4) * Kp * Math.sin(dp) * 18 * 25 / 2, 1e-5);
    proche(v[0].appuisBas, (r.combinaisons[0].appuis[0].axial / 2.5) * Math.sin((20 * Math.PI) / 180));
    expect(v[0].appuisBas).toBeGreaterThan(0);
    proche(v[0].taux, v[0].buteeHaut / (v[0].appuisBas + v[0].pousseeBas));
  });

  it('poids propre : diminue le taux, augmente la force nette en pied', () => {
    const d = sec();
    const sans = verifierFond(d, verifierParoi(d)).vertical[0];
    d.poidsParoi = 50;
    const avec = verifierFond(d, verifierParoi(d)).vertical[0];
    expect(avec.poidsParoi).toBe(50);
    expect(avec.taux).toBeLessThan(sans.taux);
    proche(avec.netBas, Math.max(0, sans.appuisBas + sans.pousseeBas + 50 - sans.buteeHaut));
  });

  it('une valeur par combinaison', () => {
    const d = base();
    const r = verifierParoi(d);
    expect(verifierFond(d, r).vertical.map((x) => x.combinaison)).toEqual(r.combinaisons.map((x) => x.nom));
  });
});

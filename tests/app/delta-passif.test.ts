// Tests d'acceptation de « Trouver δ passif » (20/11/2026, Claude, a la demande de l'utilisateur).
// Plus grand facteur commun sur les k_tan δ passifs des couches tel que l'equilibre vertical
// (EN 1997-3, 7.6.4) soit satisfait dans toutes les phases. A ne pas modifier.
import { describe, expect, it } from 'vitest';
import { deltaPassifPropose, lireSaisie, phasesGenerees, saisieParDefaut, verifier, verifierPhasage, type Saisie } from '../../app/src/form';
import { verifierFond } from '../../src/fond';

function phasee(): Saisie {
  const s = saisieParDefaut();
  s.appuis.push({ ...s.appuis[0], nom: 'A2', z: '3,5' });
  s.phasage = true;
  s.phases = phasesGenerees(s);
  return s;
}

/** Plus grand taux d'equilibre vertical, toutes phases ; Infinity si le calcul echoue. */
function pireVertical(s: Saisie): number {
  const l = lireSaisie(s);
  if (!l.ok) return Infinity;
  try {
    const rp = verifierPhasage(l.calcul);
    if (rp !== null) return Math.max(...rp.phases.flatMap((x) => x.fond.vertical.map((v) => v.taux)));
    const r = verifier(l.calcul);
    return Math.max(...verifierFond(l.calcul.donnees, r).vertical.map((v) => v.taux));
  } catch {
    return Infinity;
  }
}

const appliquer = (s: Saisie, k: string[]): Saisie => ({ ...s, couches: s.couches.map((c, i) => ({ ...c, kDeltaP: k[i] })) });
const nombre = (t: string): number => Number(t.replace(',', '.'));

// Recherche par dichotomie, un calcul complet par essai : delai porte a 30 s (machines de CI plus lentes).
describe('Trouver δ passif', { timeout: 30000 }, () => {
  it('cas phase : equilibre vertical satisfait partout, et c est le plus grand', () => {
    const s = phasee();
    expect(pireVertical(s)).toBeGreaterThan(1);
    const p = deltaPassifPropose(s);
    if (p === null || p === 'deja') throw new Error(String(p));
    expect(p.facteur).toBeGreaterThan(0);
    expect(p.facteur).toBeLessThan(1);
    expect(p.couches).toHaveLength(s.couches.length);
    for (const k of p.couches) expect(k).toMatch(/^\d+(,\d{1,3})?$/);
    expect(pireVertical(appliquer(s, p.couches))).toBeLessThanOrEqual(1);
    const plus = p.couches.map((k) => String(nombre(k) + 0.01).replace('.', ','));
    expect(pireVertical(appliquer(s, plus))).toBeGreaterThan(1);
  });
  it('garde les rapports entre couches (facteur commun)', () => {
    const s = phasee();
    s.couches[0].kDeltaP = '1/3';
    const p = deltaPassifPropose(s);
    if (p === null || p === 'deja') throw new Error(String(p));
    expect(nombre(p.couches[0])).toBeCloseTo((1 / 3) * p.facteur, 2);
    expect(nombre(p.couches[1])).toBeCloseTo((2 / 3) * p.facteur, 2);
  });
  it('deja satisfait : rien a changer', () => {
    const s = saisieParDefaut();
    expect(pireVertical(s)).toBeLessThanOrEqual(1);
    expect(deltaPassifPropose(s)).toBe('deja');
  });
  it('sans phasage, console : la configuration finale seule', () => {
    const s = saisieParDefaut();
    s.appuis = [];
    s.degre = '100';
    s.L = '12';
    if (pireVertical(s) <= 1) return expect(deltaPassifPropose(s)).toBe('deja');
    const p = deltaPassifPropose(s);
    if (p === null || p === 'deja') throw new Error(String(p));
    expect(pireVertical(appliquer(s, p.couches))).toBeLessThanOrEqual(1);
  });
  it('saisie illisible : null', () => {
    const s = saisieParDefaut();
    s.H = 'x';
    expect(deltaPassifPropose(s)).toBe(null);
  });
});

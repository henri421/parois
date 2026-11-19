// Tests d'acceptation du phasage (lot F, PLAN-phasage.md, T1). Ecrits par Claude le 20/11/2026.
// Chaque phase est un etat d'equilibre limite independant : les attendus sont ceux de
// verifierParoi applique aux donnees de la phase. A ne pas modifier.
import { describe, expect, it } from 'vitest';
import { verifierParoi, type Appui, type Couche, type DonneesParoi } from '../src/parois';
import { verifierFond } from '../src/fond';
import { donneesDePhase, phasesAutomatiques, verifierPhases, type Phase } from '../src/phases';

const c = (nom: string, h: number, gamma: number, gammaSat: number, phi: number, co: number): Couche =>
  ({ nom, h, gamma, gammaSat, phi, c: co, kDeltaA: 2 / 3, kDeltaP: 2 / 3, KaImpose: null, KpImpose: null });

const tirant = (nom: string, z: number): Appui =>
  ({ nom, type: 'tirant', z, inclinaison: 0, entraxe: 2.5, EA: null, longueur: null, effortImpose: null, lierne: 'continue' });

/** Fouille de 8 m a deux niveaux de tirants, pied libre, 2e generation. */
function cas(): DonneesParoi {
  return {
    H: 8, L: 12, EI: 125000, EA: 5e6,
    couches: [c('Remblai', 3, 18, 20, 30, 0), c('Limon', 4, 19, 20, 26, 5), c('Sable', 30, 19, 21, 35, 0)],
    eau: { zTerre: 3, zFouille: 8.5, ecoulement: true },
    charges: [{ type: 'repartie', nature: 'variable', q: 10 }],
    appuis: [tirant('A2', 4.5), tirant('A1', 1.5)],
    degreEncastrement: 0,
    partK0: 0,
    redistribution: { forme: 'aucune' },
    norme: { generation: 2, cc: 'CC2', approche: 'a+b' },
  };
}

const finale = (d: DonneesParoi): Phase => ({ nom: 'Phase finale', H: d.H, appuis: d.appuis.map((a) => a.nom), zEau: d.eau.zFouille });

describe('phases automatiques', () => {
  it('creuser 0,5 m sous chaque appui (dans l ordre des profondeurs), le poser, puis le fond final', () => {
    const p = phasesAutomatiques(cas());
    expect(p.map((x) => x.H)).toEqual([2, 5, 8]);
    expect(p.map((x) => x.appuis)).toEqual([[], ['A1'], ['A2', 'A1']]);
    expect(p.map((x) => x.nom)).toEqual(['Phase 1', 'Phase 2', 'Phase 3']);
  });
  it('eau cote fouille : suit le fond (pompage) sans remonter au-dessus de la nappe ; finale = saisie', () => {
    const p = phasesAutomatiques(cas());
    expect(p[0].zEau).toBe(3); // fond a 2 m, nappe a 3 m : l'eau reste a 3 m
    expect(p[1].zEau).toBe(5);
    expect(p[2].zEau).toBe(8.5);
  });
  it('surexcavation modifiable', () => {
    expect(phasesAutomatiques(cas(), 1).map((x) => x.H)).toEqual([2.5, 5.5, 8]);
  });
  it('un appui trop pres du fond final ne cree pas de phase au-dela du fond', () => {
    const d = cas();
    d.appuis = [tirant('A1', 1.5), tirant('A2', 7.8)];
    const p = phasesAutomatiques(d);
    expect(p.map((x) => x.H)).toEqual([2, 8]);
    expect(p[1].appuis).toEqual(['A1', 'A2']);
  });
  it('sans appui : une seule phase, la finale', () => {
    const d = cas();
    d.appuis = [];
    d.degreEncastrement = 1;
    expect(phasesAutomatiques(d)).toEqual([finale(d)].map((x) => ({ ...x, nom: 'Phase 1' })));
  });
});

describe('donnees d une phase', () => {
  it('fond, appuis en place et eau de la phase ; le reste inchange', () => {
    const d = cas();
    const p: Phase = { nom: 'Phase 2', H: 5, appuis: ['A1'], zEau: 5 };
    const dp = donneesDePhase(d, p);
    expect(dp.H).toBe(5);
    expect(dp.appuis.map((a) => a.nom)).toEqual(['A1']);
    expect(dp.eau).toEqual({ zTerre: 3, zFouille: 5, ecoulement: true });
    expect(dp.L).toBe(12);
    expect(dp.couches).toEqual(d.couches);
    expect(dp.charges).toEqual(d.charges);
    expect(dp.degreEncastrement).toBe(0);
  });
  it('console (aucun appui porteur) : pied encastre a 100 %', () => {
    const dp = donneesDePhase(cas(), { nom: 'Phase 1', H: 2, appuis: [], zEau: 3 });
    expect(dp.degreEncastrement).toBe(1);
  });
  it('refus : appui pose sous le fond de sa phase, appui inconnu, fond hors paroi, eau au-dessus du fond', () => {
    const d = cas();
    expect(() => donneesDePhase(d, { nom: 'Phase 2', H: 4, appuis: ['A2'], zEau: 4 })).toThrow(/A2.*Phase 2|Phase 2.*A2/);
    expect(() => donneesDePhase(d, { nom: 'Phase 2', H: 5, appuis: ['A9'], zEau: 5 })).toThrow(/A9/);
    expect(() => donneesDePhase(d, { nom: 'Phase 2', H: 9, appuis: [], zEau: 9 })).toThrow(/Phase 2/);
    expect(() => donneesDePhase(d, { nom: 'Phase 2', H: 0, appuis: [], zEau: 1 })).toThrow(/Phase 2/);
    expect(() => donneesDePhase(d, { nom: 'Phase 2', H: 5, appuis: ['A1'], zEau: 4 })).toThrow(/Phase 2/);
  });
});

describe('verification phasee', () => {
  const d = cas();
  const phases = phasesAutomatiques(d);
  const r = verifierPhases(d, phases);

  it('chaque phase = verifierParoi et verifierFond sur ses donnees', () => {
    expect(r.phases).toHaveLength(3);
    r.phases.forEach((x, i) => {
      const dp = donneesDePhase(d, phases[i]);
      const attendu = verifierParoi(dp);
      expect(x.phase).toEqual(phases[i]);
      expect(x.resultat.gouvernant).toEqual(attendu.gouvernant);
      expect(x.resultat.Md).toBeCloseTo(attendu.Md, 9);
      expect(x.fond).toEqual(verifierFond(dp, attendu));
    });
  });
  it('la phase finale reproduit le calcul non phase', () => {
    const f = verifierParoi(d);
    expect(r.phases[2].resultat.gouvernant).toEqual(f.gouvernant);
    expect(r.phases[2].resultat.Md).toBeCloseTo(f.Md, 9);
  });
  it('phase et combinaison determinantes : la plus grande mobilisation', () => {
    let max = -1;
    let ph = '';
    let co = '';
    for (const x of r.phases) for (const k of x.resultat.combinaisons) if (k.mobilisation > max) { max = k.mobilisation; ph = x.phase.nom; co = k.nom; }
    expect(r.determinante).toEqual({ phase: ph, combinaison: co, mobilisation: max });
  });
  it('longueur requise : le maximum de (fond + fiche minimale) sur les phases et combinaisons', () => {
    let max = 0;
    let ph = '';
    for (const x of r.phases) for (const k of x.resultat.combinaisons) {
      const l = x.phase.H + (k.ficheMinimale as number);
      if (l > max) { max = l; ph = x.phase.nom; }
    }
    expect(r.longueurRequise.valeur).toBeCloseTo(max, 9);
    expect(r.longueurRequise.phase).toBe(ph);
  });
  it('appuis : effort maximal de chaque appui, avec sa phase et sa combinaison', () => {
    for (const nom of ['A1', 'A2']) {
      let max = 0;
      let ph = '';
      for (const x of r.phases) for (const k of x.resultat.combinaisons) for (const a of k.appuis) {
        if (a.nom === nom && Math.abs(a.Rh) > max) { max = Math.abs(a.Rh); ph = x.phase.nom; }
      }
      const e = r.appuis.find((a) => a.nom === nom)!;
      expect(e.Rh).toBeCloseTo(max, 9);
      expect(e.phase).toBe(ph);
    }
    expect(r.appuis.find((a) => a.nom === 'A2')!.phase).toBe('Phase 3');
  });
  it('Md et Vd : maxima des phases', () => {
    expect(r.Md).toBeCloseTo(Math.max(...r.phases.map((x) => x.resultat.Md)), 9);
    expect(r.Vd).toBeCloseTo(Math.max(...r.phases.map((x) => x.resultat.Vd)), 9);
  });
  it('enveloppe : grille commune de la tete au pied, bornes de toutes les courbes', () => {
    const e = r.enveloppe;
    expect(e.z[0]).toBe(0);
    expect(e.z[e.z.length - 1]).toBeCloseTo(d.L, 9);
    for (const k of ['Mmin', 'Mmax', 'Vmin', 'Vmax'] as const) expect(e[k]).toHaveLength(e.z.length);
    for (let i = 0; i < e.z.length; i++) {
      expect(e.Mmin[i]).toBeLessThanOrEqual(e.Mmax[i]);
      expect(e.Vmin[i]).toBeLessThanOrEqual(e.Vmax[i]);
      expect(Number.isFinite(e.Mmax[i] + e.Mmin[i] + e.Vmax[i] + e.Vmin[i])).toBe(true);
    }
    // L'extreme de l'enveloppe retrouve Md a la discretisation pres (2 %).
    const ext = Math.max(...e.Mmax.map(Math.abs), ...e.Mmin.map(Math.abs));
    expect(Math.abs(ext - r.Md) / r.Md).toBeLessThan(0.02);
  });
  it('la derniere phase doit etre la configuration finale', () => {
    expect(() => verifierPhases(d, phases.slice(0, 2))).toThrow(/finale/);
    expect(() => verifierPhases(d, [])).toThrow(/finale/);
  });
});

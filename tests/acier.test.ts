// Tests d'acceptation de la verification acier (T1 de PLAN.md, lot acier). A ne pas modifier.
// Les attendus rejouent sections-ec3 avec les efforts definis dans PLAN.md : ils controlent le choix
// des efforts, des longueurs et des options, pas le moteur EN 1993-1-1 deja valide dans sections-ec3.
import { describe, expect, it } from 'vitest';
import { ec3Recommande, profilCatalogue, verifierElement, type DonneesElement } from 'sections-ec3';
import { verifierAcier, type DonneesAcier } from '../src/acier';
import { verifierParoi, type DonneesParoi } from '../src/parois';

const proche = (x: number, attendu: number, rel = 1e-9) =>
  expect(Math.abs(x - attendu)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(attendu)));

function cas(): DonneesParoi {
  return {
    H: 5, L: 7.5, EI: 2.1e8 * 25170e-8 / 2.2, EA: 2.1e8 * 149e-4 / 2.2,
    couches: [{ nom: 'Sable', h: 30, gamma: 18, gammaSat: 21, phi: 35, c: 0, kDeltaA: 2 / 3, kDeltaP: 0.5, KaImpose: null, KpImpose: null }],
    eau: { zTerre: 5, zFouille: 5, ecoulement: false },
    charges: [{ type: 'repartie', nature: 'variable', q: 10 }],
    appuis: [
      { nom: 'B1', type: 'buton', z: 0.5, inclinaison: 0, entraxe: 4, EA: 4e5, longueur: 9, effortImpose: null, lierne: 'continue' },
      { nom: 'T2', type: 'tirant', z: 2.5, inclinaison: 15, entraxe: 2.2, EA: 2.1e5, longueur: 10, effortImpose: null, lierne: 'deux-appuis' },
    ],
    degreEncastrement: 0, partK0: 0, redistribution: { forme: 'rectangle' },
    norme: { generation: 1, profil: 'recommande', approche: 'DA2' },
  };
}

const complet = (): DonneesAcier => ({
  paroi: { profil: 'HEB 300', nuance: 'S235', entraxe: 2.2 },
  butons: [{ profil: 'HEB 200', nuance: 'S355' }, { profil: 'HEB 200', nuance: 'S355' }],
  liernes: [{ profil: 'HEB 160', nuance: 'S235' }, { profil: 'IPE 270', nuance: 'S275' }],
});

/** Rejoue sections-ec3 et rend le plus grand taux applicable. */
function tauxAttendu(profil: string, nuance: DonneesElement['nuance'], N: number, M: number, V: number, longueur: number): number {
  const mm = longueur * 1000;
  const e = verifierElement({
    profil: profilCatalogue(profil), nuance, N, My: M, Mz: 0, Vz: V, Vy: 0,
    Lcr_y: mm, Lcr_z: mm, L_LT: mm, deversementEmpeche: false,
    diagrammeLT: { type: 'lineaire', psi: 1 }, pointApplication: 'centre', McrSaisi: null,
    diagrammeY: { type: 'lineaire', psi: 1 }, diagrammeZ: { type: 'lineaire', psi: 1 },
  }, ec3Recommande());
  return Math.max(...e.verifications.filter((v) => v.applicable && v.taux !== null).map((v) => v.taux as number));
}

describe('verification acier', () => {
  const d = cas();
  const r = verifierParoi(d);
  const res = verifierAcier(d, r, complet());

  it('elements retenus et ordre : paroi, butons, liernes', () => {
    expect(res.map((x) => `${x.type}:${x.nom}`)).toEqual(['paroi:', 'buton:B1', 'lierne:B1', 'lierne:T2']);
  });

  it('profil de berlinoise : enveloppe par metre multipliee par l entraxe, longueur L', () => {
    const p = res[0];
    proche(p.M, r.Md * 2.2);
    proche(p.V, r.Vd * 2.2);
    proche(p.N, Math.max(...r.combinaisons.map((c) => c.Nmax)) * 2.2);
    proche(p.longueur, 7.5);
    expect(p.erreur).toBeNull();
    proche(p.taux!, tauxAttendu('HEB 300', 'S235', p.N, p.M, p.V, 7.5));
  });

  it('buton : compression |axial| maximale, sans flexion, longueur de l appui', () => {
    const b = res[1];
    proche(b.N, Math.max(...r.combinaisons.map((c) => Math.abs(c.appuis[0].axial))));
    expect(b.M).toBe(0);
    expect(b.V).toBe(0);
    proche(b.longueur, 9);
    proche(b.taux!, tauxAttendu('HEB 200', 'S355', b.N, 0, 0, 9));
  });

  it('liernes : M de lierne, V = 0,6 ou 0,5 R_h.a, longueur = entraxe', () => {
    const [l1, l2] = [res[2], res[3]];
    proche(l1.M, Math.max(...r.combinaisons.map((c) => c.appuis[0].Mlierne)));
    proche(l1.V, Math.max(...r.combinaisons.map((c) => 0.6 * Math.abs(c.appuis[0].Rh) * 4)));
    expect(l1.N).toBe(0);
    proche(l1.longueur, 4);
    proche(l1.taux!, tauxAttendu('HEB 160', 'S235', 0, l1.M, l1.V, 4));
    proche(l2.V, Math.max(...r.combinaisons.map((c) => 0.5 * Math.abs(c.appuis[1].Rh) * 2.2)));
    proche(l2.taux!, tauxAttendu('IPE 270', 'S275', 0, l2.M, l2.V, 2.2));
  });

  it('rien a verifier : tableau vide ; un tirant n a jamais de buton', () => {
    expect(verifierAcier(d, r, { paroi: null, butons: [null, null], liernes: [null, null] })).toEqual([]);
    const seul = verifierAcier(d, r, { paroi: null, butons: [null, { profil: 'HEB 200', nuance: 'S235' }], liernes: [null, null] });
    expect(seul).toEqual([]);
  });

  it('erreurs codees : profil inconnu, buton sans longueur', () => {
    const inconnu = verifierAcier(d, r, { paroi: { profil: 'XYZ 999', nuance: 'S235', entraxe: 2 }, butons: [null, null], liernes: [null, null] });
    expect(inconnu).toHaveLength(1);
    expect(inconnu[0].erreur).toBe('profil');
    expect(inconnu[0].taux).toBeNull();
    const d2 = cas();
    d2.appuis[0] = { ...d2.appuis[0], EA: null, longueur: null };
    const r2 = verifierParoi(d2);
    const sans = verifierAcier(d2, r2, { paroi: null, butons: [{ profil: 'HEB 200', nuance: 'S235' }, null], liernes: [null, null] });
    expect(sans[0].erreur).toBe('longueur');
    expect(sans[0].taux).toBeNull();
  });
});

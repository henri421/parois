// Tests d'acceptation du noyau parois. Attendus de tests/attendus.py : integration directe et
// methode des forces, sans element fini ni code de l'outil. A ne pas modifier.
import { describe, expect, it } from 'vitest';
import { coefficientKq, coefficientNonDraine, pressionBande, verifierParoi, type Appui, type Couche, type DonneesParoi, type NormeParoi } from '../src/parois';

const proche = (x: number, attendu: number, rel = 0.006) =>
  expect(Math.abs(x - attendu) / Math.abs(attendu)).toBeLessThanOrEqual(rel);

const c = (nom: string, h: number, gamma: number, gammaSat: number, phi: number, co: number, k = 2 / 3): Couche =>
  ({ nom, h, gamma, gammaSat, phi, c: co, kDeltaA: k, kDeltaP: k, KaImpose: null, KpImpose: null });

const tirant = (z: number, nom = 'T1'): Appui =>
  ({ nom, type: 'tirant', z, inclinaison: 0, entraxe: 2.5, EA: null, longueur: null, effortImpose: null, lierne: 'continue' });

const n2: NormeParoi = { generation: 2, cc: 'CC2', approche: 'a+b' };

function cas(): DonneesParoi {
  return {
    H: 6, L: 10, EI: 125000, EA: 5e6,
    couches: [c('Remblai', 3, 18, 20, 30, 0), c('Limon', 4, 19, 20, 26, 5), c('Sable', 30, 19, 21, 35, 0)],
    eau: { zTerre: 2.5, zFouille: 6.5, ecoulement: true },
    charges: [{ type: 'repartie', nature: 'variable', q: 10 }],
    appuis: [tirant(1.2)],
    degreEncastrement: 0,
    partK0: 0,
    redistribution: { forme: 'aucune' },
    norme: n2,
  };
}

const combi = (d: DonneesParoi, nom: string) => verifierParoi(d).combinaisons.find((x) => x.nom === nom)!;

describe('coefficients', () => {
  it('annexe D', () => {
    proche(coefficientKq((30 * Math.PI) / 180, (20 * Math.PI) / 180, true), 0.3035287476167703, 1e-9);
    proche(coefficientKq((30 * Math.PI) / 180, (-20 * Math.PI) / 180, false), 4.930031995706238, 1e-9);
    proche(coefficientNonDraine(0.5), 1 + Math.asin(0.5) + Math.cos(Math.asin(0.5)), 1e-12);
  });
  it('bande tres large au contact : Boussinesq, doublee si rigide', () => {
    proche(pressionBande(10, 0, 1e7, 3, true), 10, 1e-4);
    proche(pressionBande(10, 0, 1e7, 3, false), 5, 1e-4);
  });
});

describe('paroi ancree, pied libre', () => {
  it('combinaison (b)', () => {
    const r = combi(cas(), '(b)');
    proche(r.mobilisation, 0.7437694916589915);
    proche(r.Mmax, 265.30034379170183);
    proche(r.Vmax, 111.98181866699814);
    proche(r.appuis[0].Rh, 122.13274854293675);
    proche(r.ficheMinimale!, 3.1349999999941005, 0.01);
  });
  it('combinaison (a), effets majores', () => {
    const r = combi(cas(), '(a)');
    proche(r.mobilisation, 0.41116306345843895);
    proche(r.Mmax, 300.7736286668761);
    proche(r.appuis[0].Rh, 133.25957787550507);
  });
  it('approche (d)', () => {
    const d = cas();
    d.norme = { generation: 2, cc: 'CC2', approche: 'd' };
    const r = combi(d, '(d)');
    proche(r.mobilisation, 0.7770981899364491);
    proche(r.Mmax, 300.7736286668753);
  });
  it('service : deformee', () => {
    const s = verifierParoi(cas()).service;
    proche(s.wMax, 12.749125530393236);
    proche(s.wTete, -5.698447853320699);
  });
  it('equilibre : tranchant et moment nuls en pied', () => {
    const r = combi(cas(), '(b)');
    expect(Math.abs(r.courbes.V[r.courbes.V.length - 1])).toBeLessThan(0.01);
    expect(Math.abs(r.courbes.M[r.courbes.M.length - 1])).toBeLessThan(0.05);
  });
  it('gouvernant, lierne', () => {
    const v = verifierParoi(cas());
    expect(v.gouvernant.combinaison).toBe('(b)');
    const a = combi(cas(), '(b)').appuis[0];
    proche(a.Mlierne, (a.Rh * 2.5 * 2.5) / 10, 1e-9);
    proche(a.axial, a.Rh * 2.5, 1e-6);
  });
});

describe('appuis multiples, efforts imposes, tirant incline', () => {
  it('deux tirants : hyperstatique', () => {
    const d = cas();
    d.L = 9.5;
    d.appuis = [tirant(1.2), tirant(3.8, 'T2')];
    const r = combi(d, '(b)');
    proche(r.mobilisation, 0.6352796806158881);
    proche(r.Mmax, 85.25169369263693);
    proche(r.Vmax, 114.80551102519325);
    proche(r.appuis[0].Rh, 2.833923165848908, 0.03);
    proche(r.appuis[1].Rh, 177.81931056215882);
  });
  it('effort impose', () => {
    const d = cas();
    d.L = 9.5;
    d.appuis = [{ ...tirant(1.2), effortImpose: 250 }, tirant(3.8, 'T2')];
    const r = combi(d, '(b)');
    proche(r.mobilisation, 0.844177137266856);
    proche(r.Mmax, 209.10091020802008);
    proche(r.appuis[1].Rh, 22.61556341419734);
    proche(r.appuis[0].axial, 250, 1e-9);
  });
  it('tirant incline : effort axial et compression de la paroi', () => {
    const d = cas();
    d.appuis = [{ ...tirant(1.2), inclinaison: 20 }];
    const r = combi(d, '(b)');
    const a = r.appuis[0];
    proche(a.axial, (a.Rh * 2.5) / Math.cos((20 * Math.PI) / 180), 1e-6);
    proche(r.Nmax, (a.Rh) * Math.tan((20 * Math.PI) / 180), 1e-6);
  });
  it('appui souple : plus de deplacement', () => {
    const d = cas();
    d.appuis = [{ ...tirant(1.2), EA: 200000, longueur: 12 }];
    expect(Math.abs(verifierParoi(d).service.wTete)).not.toBe(Math.abs(verifierParoi(cas()).service.wTete));
    expect(verifierParoi(d).service.wMax).toBeGreaterThan(verifierParoi(cas()).service.wMax);
  });
});

describe('console encastree', () => {
  const d = (): DonneesParoi => ({
    ...cas(), H: 3, L: 8, appuis: [], degreEncastrement: 1,
    eau: { zTerre: 20, zFouille: 20, ecoulement: false },
  });
  it('mobilisation, moment, fiche', () => {
    const r = combi(d(), '(b)');
    proche(r.mobilisation, 0.6351947426733756);
    proche(r.Mmax, 121.13823432226224);
    proche(r.ficheMinimale!, 3.5051999999912127, 0.01);
  });
  it('sans appui, pied libre refuse', () => {
    const x = d();
    x.degreEncastrement = 0;
    expect(() => verifierParoi(x)).toThrow(/encastré/);
  });
});

describe('poussee', () => {
  it('redistribution rectangulaire', () => {
    const d = cas();
    d.redistribution = { forme: 'rectangle' };
    const r = combi(d, '(b)');
    proche(r.mobilisation, 0.7080386572130035);
    proche(r.Mmax, 227.66686532131786);
    proche(r.appuis[0].Rh, 134.95010273899356);
  });
  it('polygone egal au rectangle', () => {
    const a = cas();
    a.redistribution = { forme: 'rectangle' };
    const b = cas();
    b.redistribution = { forme: 'polygone', polygone: [[0, 2], [0.5, 2], [1, 2]] };
    proche(combi(b, '(b)').Mmax, combi(a, '(b)').Mmax, 1e-6);
  });
  it('moitie K0', () => {
    const d = cas();
    d.partK0 = 0.5;
    const r = combi(d, '(b)');
    proche(r.mobilisation, 0.9589091483306134);
    proche(r.Mmax, 337.7415780181683);
  });
  it('argile non drainee', () => {
    const d: DonneesParoi = {
      ...cas(), L: 9,
      couches: [c('Argile', 40, 19, 19, 0, 60, 0.5)],
      eau: { zTerre: 50, zFouille: 50, ecoulement: false },
      norme: { generation: 2, cc: 'CC2', approche: 'd' },
      modifications: { gG: 1, gQ: 1, gRe: 1 },
    };
    const r = combi(d, '(d)');
    proche(r.mobilisation, 0.1463650952941449);
    proche(r.Mmax, 32.592422337150424);
    proche(r.appuis[0].Rh, 21.623570649186462);
  });
  it('Ka et Kp imposes modifient le resultat', () => {
    const d = cas();
    d.couches = d.couches.map((x) => ({ ...x, KaImpose: 0.5 }));
    expect(combi(d, '(b)').Mmax).toBeGreaterThan(combi(cas(), '(b)').Mmax);
  });
});

describe('charges ponctuelles et sens', () => {
  it('force en tete vers la fouille : reaction accrue', () => {
    const d = cas();
    d.charges.push({ type: 'force', nature: 'permanente', z: 0.5, H: 20 });
    expect(combi(d, '(b)').appuis[0].Rh).toBeGreaterThan(combi(cas(), '(b)').appuis[0].Rh + 10);
  });
  it('bande et pression imposee', () => {
    const d = cas();
    d.charges.push({ type: 'bande', nature: 'variable', q: 30, a: 1, b: 2, rigide: true });
    d.charges.push({ type: 'pression', nature: 'permanente', z1: 1, z2: 2, p1: 5, p2: 5 });
    expect(combi(d, '(b)').Mmax).toBeGreaterThan(combi(cas(), '(b)').Mmax);
  });
});

describe('generations et coefficients', () => {
  it('1re generation', () => {
    const d = cas();
    d.norme = { generation: 1, profil: 'recommande', approche: 'DA1' };
    expect(verifierParoi(d).combinaisons.map((x) => x.nom)).toEqual(['DA1-1', 'DA1-2']);
    d.norme = { generation: 1, profil: 'recommande', approche: 'DA2' };
    expect(verifierParoi(d).combinaisons.map((x) => x.nom)).toEqual(['DA2']);
    d.norme = { generation: 1, profil: 'anb', risque: 'normal' };
    expect(verifierParoi(d).combinaisons[0].nom).toBe('DA1-1');
  });
  it('coefficient modifie : applique et signale', () => {
    const d = cas();
    d.modifications = { gQ: 1.8 };
    const r = combi(d, '(b)');
    expect(r.Mmax).toBeGreaterThan(combi(cas(), '(b)').Mmax);
    expect(r.coefficients.some((k) => k.source.includes('modifié'))).toBe(true);
  });
  it('sources renseignees', () => {
    for (const x of verifierParoi(cas()).combinaisons) for (const k of x.coefficients) expect(k.source.length).toBeGreaterThan(0);
  });
});

describe('degre d encastrement et refus', () => {
  it('intermediaire entre les deux limites', () => {
    const t = (g: number) => {
      const d = cas();
      d.degreEncastrement = g;
      return combi(d, '(b)');
    };
    const [a, b, m] = [t(0), t(1), t(0.5)];
    proche(m.mobilisation, (a.mobilisation + b.mobilisation) / 2, 1e-9);
    proche(m.ficheMinimale!, (a.ficheMinimale! + b.ficheMinimale!) / 2, 1e-9);
  });
  it('saisies invalides', () => {
    const v = (m: (d: DonneesParoi) => void) => {
      const d = cas();
      m(d);
      return () => verifierParoi(d);
    };
    expect(v((d) => { d.L = 5; })).toThrow(/longueur/i);
    expect(v((d) => { d.EI = 0; })).toThrow(/EI/);
    expect(v((d) => { d.couches = []; })).toThrow(/couche/);
    expect(v((d) => { d.appuis[0].z = 7; })).toThrow(/niveau/);
    expect(v((d) => { d.couches[0].kDeltaA = 1.5; })).toThrow(/δ/);
    expect(v((d) => { d.appuis[0].EA = 10; })).toThrow(/EA/);
  });
});

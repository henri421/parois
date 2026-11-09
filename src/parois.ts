/**
 * Noyau de verification d'une paroi encastree (V1) : portique 2D, paroi et appuis, selon
 * l'EN 1997-3:2025, clause 7 et annexe D, ou l'EN 1997-1:2004.
 * Pur : aucune dependance au DOM. Unites : m, kN, kPa, degres en entree.
 * Convention : z vers le bas depuis la tete, x positif vers la fouille.
 * EI w'' = M, M' = V, V' = q : q positif pousse vers la fouille.
 */

import {
  combinaisons1g,
  profil1g,
  profil2g,
  profilAnb2022,
  type Approche,
  type ClasseConsequences,
  type Risque,
} from 'sol-ec7';

const GAMMA_W = 10;
/** Raideur d'un appui declare rigide (kN/m par metre de paroi). */
const RIGIDE = 1e10;
const PAS = 0.05;

export type Nature = 'permanente' | 'variable';

export interface Couche {
  nom: string;
  h: number;
  gamma: number;
  gammaSat: number;
  /** phi' en degres ; 0 = comportement non draine, c est alors c_u. */
  phi: number;
  c: number;
  /** k_tan_delta actif et passif (formule 7.1), ou a/c si phi = 0. */
  kDeltaA: number;
  kDeltaP: number;
  /** Coefficients horizontaux imposes : nul pour le calcul de l'annexe D. */
  KaImpose: number | null;
  KpImpose: number | null;
}

export type Charge =
  | { type: 'repartie'; nature: Nature; q: number }
  | { type: 'bande'; nature: Nature; q: number; a: number; b: number; rigide: boolean }
  | { type: 'force'; nature: Nature; z: number; H: number }
  | { type: 'moment'; nature: Nature; z: number; M: number }
  | { type: 'pression'; nature: Nature; z1: number; z2: number; p1: number; p2: number };

export interface Appui {
  nom: string;
  type: 'tirant' | 'buton';
  z: number;
  /** Inclinaison sur l'horizontale, vers le bas (degres). */
  inclinaison: number;
  entraxe: number;
  /** EA (kN) et longueur (m) de l'appui ; nul = appui rigide. */
  EA: number | null;
  longueur: number | null;
  /** Effort axial impose par appui (kN), positif ; remplace la raideur. */
  effortImpose: number | null;
  lierne: 'continue' | 'deux-appuis' | null;
}

export type FormeRedistribution =
  | 'aucune' | 'rectangle' | 'triangle-haut' | 'triangle-milieu' | 'triangle-bas' | 'trapeze' | 'polygone';

export interface Redistribution {
  forme: FormeRedistribution;
  /** Pour 'polygone' : (z/H, valeur relative), z/H croissant de 0 a 1. */
  polygone?: readonly (readonly [number, number])[];
}

export type NormeParoi =
  | { generation: 2; cc: ClasseConsequences; approche: 'a+b' | 'd' }
  | { generation: 1; profil: 'recommande'; approche: Approche }
  | { generation: 1; profil: 'anb'; risque: Risque };

/** Coefficients modifies a la main : remplacent ceux de la bibliotheque. */
export interface Modifications {
  gG?: number;
  gQ?: number;
  gPhi?: number;
  gC?: number;
  gCu?: number;
  gRe?: number;
}

export interface DonneesParoi {
  H: number;
  L: number;
  EI: number;
  EA: number;
  couches: Couche[];
  eau: { zTerre: number; zFouille: number; ecoulement: boolean };
  charges: Charge[];
  appuis: Appui[];
  /** Degre d'encastrement du pied, de 0 (libre) a 1 (encastre). */
  degreEncastrement: number;
  /** Part de K0 cote terre : 0 = Ka, 1 = K0. */
  partK0: number;
  redistribution: Redistribution;
  norme: NormeParoi;
  modifications?: Modifications;
}

export interface CoefficientApplique {
  nom: string;
  valeur: number;
  source: string;
}

export interface Courbes {
  /** Points par extremite d'element : deux points a chaque noeud pour les sauts. */
  z: number[];
  q: number[];
  V: number[];
  M: number[];
  N: number[];
}

export interface ResultatAppui {
  nom: string;
  z: number;
  /** Reaction horizontale par metre de paroi (kN/m), positive vers le sol. */
  Rh: number;
  /** Effort axial par appui (kN), traction positive. */
  axial: number;
  /** Moment dans la lierne (kN.m), nul sans lierne. */
  Mlierne: number;
}

export interface ResultatCombinaison {
  nom: string;
  /** Part de la butee mobilisee : le taux de la verification de rotation. */
  mobilisation: number;
  /** Fiche minimale (m), nulle si aucune longueur n'equilibre. */
  ficheMinimale: number | null;
  Mmax: number;
  Vmax: number;
  Nmax: number;
  appuis: ResultatAppui[];
  courbes: Courbes;
  coefficients: CoefficientApplique[];
}

export interface ResultatParoi {
  generation: 1 | 2;
  combinaisons: ResultatCombinaison[];
  gouvernant: { combinaison: string; mobilisation: number };
  /** Enveloppe des efforts de calcul. */
  Md: number;
  Vd: number;
  service: { z: number[]; w: number[]; wMax: number; zWMax: number; wTete: number };
  gradient: number;
  alertes: string[];
}

// -------------------------------------------------------------------------------------------------
// Coefficients de poussee (annexe D, D.3.2)
// -------------------------------------------------------------------------------------------------

const rad = (d: number): number => (d * Math.PI) / 180;

/** Kq de D.1 a D.6, alpha = beta = lambda = 0 ; delta > 0 en actif, < 0 en passif. Angles en radians. */
export function coefficientKq(phi: number, delta: number, actif: boolean): number {
  const w = Math.asin(Math.sin(delta) / Math.sin(phi));
  if (actif) {
    const psi = (w - delta) / 2;
    return ((Math.cos(delta) - Math.sin(phi) * Math.cos(w)) / (1 + Math.sin(phi))) * Math.exp(-2 * psi * Math.tan(phi));
  }
  const psi = -(w + delta) / 2;
  return ((Math.cos(delta) + Math.sin(phi) * Math.cos(w)) / (1 - Math.sin(phi))) * Math.exp(2 * psi * Math.tan(phi));
}

/** D.9 : K_ac,u = K_pc,u, x = a/c. */
export function coefficientNonDraine(x: number): number {
  return 1 + Math.asin(x) + Math.cos(Math.asin(x));
}

/**
 * Pression d'une charge en bande sur la paroi, en elasticite : formule de Boussinesq
 * pour un demi-espace (facteur 1, paroi souple) ou doublee selon Terzaghi (facteur 2, paroi rigide).
 */
export function pressionBande(q: number, a: number, b: number, z: number, rigide: boolean): number {
  if (z <= 0) return 0;
  const t1 = Math.atan(a / z);
  const t2 = Math.atan((a + b) / z);
  const beta = t2 - t1;
  return ((rigide ? 2 : 1) * q * (beta - Math.sin(beta) * Math.cos(t1 + t2))) / Math.PI;
}

// -------------------------------------------------------------------------------------------------
// Jeux de coefficients
// -------------------------------------------------------------------------------------------------

interface Jeu {
  nom: string;
  gG: number;
  gQ: number;
  gE: number;
  gPhi: number;
  gC: number;
  gCu: number;
  gRe: number;
  coefficients: CoefficientApplique[];
}

const S73 = 'EN 1997-3:2025, tableau 7.2';

function jeux(n: NormeParoi): Jeu[] {
  if (n.generation === 2) {
    const p = profil2g();
    const kF = p.kF[n.cc].valeur;
    const kM = p.kM[n.cc].valeur;
    const kR = p.kR[n.cc].valeur;
    if (n.approche === 'd') {
      const gRe = 1.4 * kR;
      const gG = p.gG.valeur * kF;
      const gQ = p.gQ.valeur * kF;
      return [{
        nom: '(d)', gG, gQ, gE: 1, gPhi: 1, gC: 1, gCu: 1, gRe,
        coefficients: [
          { nom: 'γ_G', valeur: gG, source: p.gG.source },
          { nom: 'γ_Q', valeur: gQ, source: p.gQ.source },
          { nom: 'γ_Re', valeur: gRe, source: S73 },
        ],
      }];
    }
    const gE = p.gG.valeur * kF;
    const gM = p.gM2.valeur * kM;
    const gCu = p.gCuM2.valeur * kM;
    return [
      {
        nom: '(a)', gG: 1, gQ: p.gQ.valeur / p.gG.valeur, gE, gPhi: 1, gC: 1, gCu: 1, gRe: 1,
        coefficients: [
          { nom: 'γ_E', valeur: gE, source: `${S73}, VC4 ; ${p.gG.source}` },
          { nom: 'γ_Q/γ_G', valeur: p.gQ.valeur / p.gG.valeur, source: p.gQ.source },
        ],
      },
      {
        nom: '(b)', gG: p.gG_VC3.valeur, gQ: p.gQ_VC3.valeur, gE: 1, gPhi: gM, gC: gM, gCu, gRe: 1,
        coefficients: [
          { nom: 'γ_G', valeur: p.gG_VC3.valeur, source: `${S73}, VC3` },
          { nom: 'γ_Q', valeur: p.gQ_VC3.valeur, source: `${S73}, VC3` },
          { nom: 'γ_tan φ', valeur: gM, source: p.gM2.source },
          { nom: 'γ_c', valeur: gM, source: p.gM2.source },
          { nom: 'γ_cu', valeur: gCu, source: p.gCuM2.source },
        ],
      },
    ];
  }
  const combis = n.profil === 'anb'
    ? combinaisons1g('DA1', profilAnb2022(n.risque))
    : combinaisons1g(n.approche, profil1g());
  return combis.map((c) => {
    const gRe = c.nom === 'DA2' ? 1.4 : 1;
    return {
      nom: c.nom,
      gG: c.geotechnique.gG_dst.valeur,
      gQ: c.geotechnique.gQ_dst.valeur,
      gE: 1,
      gPhi: c.sol.gPhi.valeur,
      gC: c.sol.gC.valeur,
      gCu: c.sol.gCu.valeur,
      gRe,
      coefficients: [
        { nom: 'γ_G', valeur: c.geotechnique.gG_dst.valeur, source: c.geotechnique.gG_dst.source },
        { nom: 'γ_Q', valeur: c.geotechnique.gQ_dst.valeur, source: c.geotechnique.gQ_dst.source },
        { nom: 'γ_tan φ', valeur: c.sol.gPhi.valeur, source: c.sol.gPhi.source },
        { nom: 'γ_c', valeur: c.sol.gC.valeur, source: c.sol.gC.source },
        { nom: 'γ_Re', valeur: gRe, source: 'EN 1997-1:2004, tableau A.13, valeur recommandée' },
      ],
    };
  });
}

function appliquerModifications(j: Jeu, m: Modifications | undefined): Jeu {
  if (m === undefined) return j;
  const copie = { ...j, coefficients: [...j.coefficients] };
  const noms: [keyof Modifications, 'gG' | 'gQ' | 'gPhi' | 'gC' | 'gCu' | 'gRe', string][] = [
    ['gG', 'gG', 'γ_G'], ['gQ', 'gQ', 'γ_Q'], ['gPhi', 'gPhi', 'γ_tan φ'],
    ['gC', 'gC', 'γ_c'], ['gCu', 'gCu', 'γ_cu'], ['gRe', 'gRe', 'γ_Re'],
  ];
  for (const [cle, champ, nom] of noms) {
    const v = m[cle];
    if (v === undefined) continue;
    copie[champ] = v;
    copie.coefficients.push({ nom, valeur: v, source: `modifié par l’utilisateur (bibliothèque : ${j[champ]})` });
  }
  return copie;
}

const SERVICE: Jeu = { nom: 'caractéristique', gG: 1, gQ: 1, gE: 1, gPhi: 1, gC: 1, gCu: 1, gRe: 1, coefficients: [] };

// -------------------------------------------------------------------------------------------------
// Pressions
// -------------------------------------------------------------------------------------------------

function coucheEn(d: DonneesParoi, z: number): Couche {
  let t = 0;
  for (const c of d.couches) {
    t += c.h;
    if (z < t) return c;
  }
  return d.couches[d.couches.length - 1];
}

/** Poids des terres entre deux profondeurs, nappe zw ; la derniere couche se prolonge. */
function poids(d: DonneesParoi, z1: number, z2: number, zw: number): number {
  let total = 0;
  let t = 0;
  d.couches.forEach((c, i) => {
    const bas = i === d.couches.length - 1 ? Infinity : t + c.h;
    const a = Math.max(z1, t);
    const b = Math.min(z2, bas);
    if (b > a) {
      const sec = Math.max(0, Math.min(b, zw) - a);
      total += c.gamma * sec + c.gammaSat * (b - a - sec);
    }
    t = bas;
  });
  return total;
}

function gradientHydraulique(d: DonneesParoi, L: number): number {
  const { zTerre, zFouille, ecoulement } = d.eau;
  if (!ecoulement || zFouille <= zTerre) return 0;
  return (zFouille - zTerre) / (L - zTerre + (L - zFouille));
}

interface Pressions {
  eG: number;
  eQ: number;
  eau: number;
  butee: number;
}

function pressionsEn(d: DonneesParoi, j: Jeu, z: number, eps: number, L: number): Pressions {
  const c = coucheEn(d, z + eps);
  const i = gradientHydraulique(d, L);
  const { zTerre, zFouille } = d.eau;
  const ua = GAMMA_W * Math.max(0, z - zTerre) * (1 - i);
  const up = GAMMA_W * Math.max(0, z - zFouille) * (1 + i);
  const sv = poids(d, 0, z, zTerre);
  const s1 = sv - ua;
  let qG = 0;
  let qQ = 0;
  for (const ch of d.charges) {
    if (ch.type !== 'repartie') continue;
    if (ch.nature === 'permanente') qG += ch.q;
    else qQ += ch.q;
  }
  let terre: (q: number) => number;
  let butee = 0;
  const profondeurFouille = z + eps >= d.H;
  const svp = profondeurFouille ? poids(d, d.H, z, zFouille) + Math.max(0, d.H - zFouille) * GAMMA_W : 0;
  const s2 = Math.max(0, svp - up);
  if (c.phi > 0) {
    const phiD = Math.atan(Math.tan(rad(c.phi)) / j.gPhi);
    const cD = c.c / j.gC;
    const da = Math.atan(c.kDeltaA * Math.tan(phiD));
    const Ka = c.KaImpose !== null ? c.KaImpose / Math.cos(da) : coefficientKq(phiD, da, true);
    const Kac = (1 / Math.cos(da) - Ka) / Math.tan(phiD);
    const K0 = 1 - Math.sin(phiD);
    terre = (q: number): number => {
      const pa = Math.max((Ka * (s1 + q) - Kac * cD) * Math.cos(da), 0.1 * (s1 + q));
      return (1 - d.partK0) * pa + d.partK0 * K0 * (s1 + q);
    };
    if (profondeurFouille) {
      const dp = Math.atan(c.kDeltaP * Math.tan(phiD));
      const Kp = c.KpImpose !== null ? c.KpImpose / Math.cos(dp) : coefficientKq(phiD, -dp, false);
      const Kpc = (Kp - 1 / Math.cos(dp)) / Math.tan(phiD);
      butee = (Kp * s2 + Kpc * cD) * Math.cos(dp);
    }
  } else {
    const cD = c.c / j.gCu;
    const Ka = coefficientNonDraine(c.kDeltaA);
    terre = (q: number): number => {
      const pa = Math.max(s1 + q - Ka * cD, 0.1 * (sv + q) - ua);
      return (1 - d.partK0) * pa + d.partK0 * (s1 + q);
    };
    if (profondeurFouille) butee = s2 + coefficientNonDraine(c.kDeltaP) * cD;
  }
  const eG = terre(qG);
  return { eG, eQ: terre(qG + qQ) - eG, eau: ua - up, butee };
}

const FORMES: Record<Exclude<FormeRedistribution, 'aucune' | 'polygone'>, readonly (readonly [number, number])[]> = {
  rectangle: [[0, 1], [1, 1]],
  'triangle-haut': [[0, 1], [1, 0]],
  'triangle-milieu': [[0, 0], [0.5, 1], [1, 0]],
  'triangle-bas': [[0, 0], [1, 1]],
  trapeze: [[0, 0], [0.2, 1], [0.8, 1], [1, 0]],
};

function polygoneDe(r: Redistribution): readonly (readonly [number, number])[] {
  if (r.forme === 'polygone') {
    const p = r.polygone ?? [];
    if (p.length < 2 || p[0][0] !== 0 || p[p.length - 1][0] !== 1) {
      throw new Error('Polygone de redistribution : il doit aller de z/H = 0 à z/H = 1.');
    }
    return p;
  }
  if (r.forme === 'aucune') throw new Error('Pas de polygone sans redistribution.');
  return FORMES[r.forme];
}

function valeurPolygone(p: readonly (readonly [number, number])[], x: number): number {
  for (let i = 1; i < p.length; i += 1) {
    if (x <= p[i][0]) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return p[p.length - 1][1];
}

// -------------------------------------------------------------------------------------------------
// Portique : maillage, assemblage, resolution
// -------------------------------------------------------------------------------------------------

function maillage(d: DonneesParoi, Ls: number): number[] {
  const pts = new Set<number>();
  const arr = (x: number): number => Math.round(x * 1e6) / 1e6;
  const n = Math.ceil(Ls / PAS);
  for (let i = 0; i <= n; i += 1) pts.add(arr((i * Ls) / n));
  const ajout = (z: number): void => {
    if (z > 0 && z < Ls) pts.add(arr(z));
  };
  ajout(d.H);
  ajout(d.eau.zTerre);
  ajout(d.eau.zFouille);
  let t = 0;
  for (const c of d.couches) {
    t += c.h;
    ajout(t);
  }
  for (const a of d.appuis) ajout(a.z);
  for (const c of d.charges) {
    if (c.type === 'force' || c.type === 'moment') ajout(c.z);
    if (c.type === 'pression') {
      ajout(c.z1);
      ajout(c.z2);
    }
  }
  const tri = [...pts].sort((a, b) => a - b);
  return tri.filter((z, i) => i === 0 || z - tri[i - 1] > 1e-5);
}

/** Matrice symetrique bande (demi-largeur 5), factorisation de Cholesky. */
class Bande {
  readonly a: Float64Array;

  readonly n: number;

  constructor(n: number) {
    this.n = n;
    this.a = new Float64Array(n * 6);
  }

  ajoute(i: number, j: number, v: number): void {
    if (j > i) return;
    this.a[i * 6 + (i - j)] += v;
  }

  bloque(i: number): void {
    for (let k = 0; k < 6; k += 1) {
      this.a[i * 6 + k] = 0;
      if (i + k < this.n) this.a[(i + k) * 6 + k] = 0;
    }
    this.a[i * 6] = 1;
  }

  factorise(): void {
    const { a, n } = this;
    for (let i = 0; i < n; i += 1) {
      for (let k = Math.max(0, i - 5); k <= i; k += 1) {
        let s = a[i * 6 + (i - k)];
        for (let m = Math.max(0, i - 5, k - 5); m < k; m += 1) s -= a[i * 6 + (i - m)] * a[k * 6 + (k - m)];
        if (k === i) {
          if (s <= 0) throw new Error('Système instable : vérifier les appuis et le pied de la paroi.');
          a[i * 6] = Math.sqrt(s);
        } else {
          a[i * 6 + (i - k)] = s / a[k * 6];
        }
      }
    }
  }

  resout(b: Float64Array): Float64Array {
    const { a, n } = this;
    const x = Float64Array.from(b);
    for (let i = 0; i < n; i += 1) {
      for (let m = Math.max(0, i - 5); m < i; m += 1) x[i] -= a[i * 6 + (i - m)] * x[m];
      x[i] /= a[i * 6];
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let m = i + 1; m <= Math.min(n - 1, i + 5); m += 1) x[i] -= a[m * 6 + (m - i)] * x[m];
      x[i] /= a[i * 6];
    }
    return x;
  }
}

interface Etat {
  phi: number;
  courbes: Courbes;
  nz: number[];
  w: number[];
  appuis: ResultatAppui[];
}

interface Extremites {
  q1: number[];
  q2: number[];
}

function vecteurAppui(a: Appui): { ex: number; ez: number } {
  const i = rad(a.inclinaison);
  return a.type === 'tirant' ? { ex: -Math.cos(i), ez: Math.sin(i) } : { ex: Math.cos(i), ez: Math.sin(i) };
}

function chargesElements(d: DonneesParoi, j: Jeu, zn: number[], L: number): { A: Extremites; B: Extremites } {
  const ne = zn.length - 1;
  const A1: number[] = [];
  const A2: number[] = [];
  const B1: number[] = [];
  const B2: number[] = [];
  const P1: Pressions[] = [];
  const P2: Pressions[] = [];
  for (let e = 0; e < ne; e += 1) {
    P1.push(pressionsEn(d, j, zn[e], 1e-7, L));
    P2.push(pressionsEn(d, j, zn[e + 1], -1e-7, L));
  }
  const r = d.redistribution;
  if (r.forme !== 'aucune') {
    const poly = polygoneDe(r);
    let aire = 0;
    const pts = 400;
    for (let k = 0; k < pts; k += 1) aire += valeurPolygone(poly, (k + 0.5) / pts) / pts;
    for (const champ of ['eG', 'eQ'] as const) {
      let E = 0;
      for (let e = 0; e < ne; e += 1) {
        if (zn[e + 1] <= d.H + 1e-9) E += ((P1[e][champ] + P2[e][champ]) / 2) * (zn[e + 1] - zn[e]);
      }
      const niveau = E / (aire * d.H);
      for (let e = 0; e < ne; e += 1) {
        if (zn[e + 1] > d.H + 1e-9) continue;
        P1[e][champ] = niveau * valeurPolygone(poly, zn[e] / d.H);
        P2[e][champ] = niveau * valeurPolygone(poly, zn[e + 1] / d.H);
      }
    }
  }
  const supp = (z: number, eps: number): number => {
    let s = 0;
    for (const c of d.charges) {
      const g = c.nature === 'permanente' ? j.gG : j.gQ;
      if (c.type === 'bande') s += g * pressionBande(c.q, c.a, c.b, z, c.rigide);
      if (c.type === 'pression' && z + eps >= c.z1 && z + eps < c.z2) {
        s += g * (c.p1 + ((c.p2 - c.p1) * (z - c.z1)) / (c.z2 - c.z1));
      }
    }
    return s;
  };
  for (let e = 0; e < ne; e += 1) {
    const f = (p: Pressions, s: number): number => j.gG * (p.eG + p.eau) + j.gQ * p.eQ + s;
    A1.push(f(P1[e], supp(zn[e], 1e-7)));
    A2.push(f(P2[e], supp(zn[e + 1], -1e-7)));
    B1.push(-P1[e].butee / j.gRe);
    B2.push(-P2[e].butee / j.gRe);
  }
  return { A: { q1: A1, q2: A2 }, B: { q1: B1, q2: B2 } };
}

function raideurAppui(a: Appui): number {
  if (a.effortImpose !== null) return 0;
  if (a.EA === null || a.longueur === null) return RIGIDE;
  return a.EA / (a.longueur * a.entraxe);
}

/** Portique pour une longueur de structure Ls et une condition de pied. encastre : rotation bloquee. */
function resoudrePortique(d: DonneesParoi, j: Jeu, Ls: number, L: number, encastre: boolean): Etat {
  const zn = maillage(d, Ls);
  const nn = zn.length;
  const ne = nn - 1;
  const K = new Bande(nn * 3);
  const { A, B } = chargesElements(d, j, zn, L);
  const fA = new Float64Array(nn * 3);
  const fB = new Float64Array(nn * 3);
  for (let e = 0; e < ne; e += 1) {
    const l = zn[e + 1] - zn[e];
    const EI = d.EI;
    const ind = [e * 3, e * 3 + 1, e * 3 + 3, e * 3 + 4];
    const kb = [
      [12, 6 * l, -12, 6 * l],
      [6 * l, 4 * l * l, -6 * l, 2 * l * l],
      [-12, -6 * l, 12, -6 * l],
      [6 * l, 2 * l * l, -6 * l, 4 * l * l],
    ];
    for (let r = 0; r < 4; r += 1) {
      for (let s = 0; s < 4; s += 1) K.ajoute(ind[r], ind[s], (kb[r][s] * EI) / (l * l * l));
    }
    const ka = d.EA / l;
    K.ajoute(e * 3 + 2, e * 3 + 2, ka);
    K.ajoute(e * 3 + 5, e * 3 + 5, ka);
    K.ajoute(e * 3 + 5, e * 3 + 2, -ka);
    const charge = (f: Float64Array, x: Extremites): void => {
      const q1 = x.q1[e];
      const q2 = x.q2[e];
      f[e * 3] += (l * (7 * q1 + 3 * q2)) / 20;
      f[e * 3 + 1] += (l * l * (3 * q1 + 2 * q2)) / 60;
      f[e * 3 + 3] += (l * (3 * q1 + 7 * q2)) / 20;
      f[e * 3 + 4] -= (l * l * (2 * q1 + 3 * q2)) / 60;
    };
    charge(fA, A);
    charge(fB, B);
  }
  const noeud = (z: number): number => {
    let m = 0;
    for (let i = 1; i < nn; i += 1) if (Math.abs(zn[i] - z) < Math.abs(zn[m] - z)) m = i;
    return m;
  };
  const appuisN = d.appuis.map((a) => {
    const n = noeud(a.z);
    const k = raideurAppui(a);
    const { ex, ez } = vecteurAppui(a);
    K.ajoute(n * 3, n * 3, k * ex * ex);
    K.ajoute(n * 3 + 2, n * 3 + 2, k * ez * ez);
    K.ajoute(n * 3 + 2, n * 3, k * ex * ez);
    if (a.effortImpose !== null) {
      const signe = a.type === 'tirant' ? 1 : -1;
      const F = (signe * a.effortImpose) / a.entraxe;
      fA[n * 3] += F * ex;
      fA[n * 3 + 2] += F * ez;
    }
    return { a, n, k, ex, ez };
  });
  const forces: { n: number; H: number; M: number }[] = [];
  for (const c of d.charges) {
    const g = c.nature === 'permanente' ? j.gG : j.gQ;
    if (c.type === 'force') {
      const n = noeud(c.z);
      fA[n * 3] += g * c.H;
      forces.push({ n, H: g * c.H, M: 0 });
    }
    if (c.type === 'moment') {
      const n = noeud(c.z);
      fA[n * 3 + 1] += g * c.M;
      forces.push({ n, H: 0, M: g * c.M });
    }
  }
  const pied = (nn - 1) * 3;
  for (const i of encastre ? [pied, pied + 1, pied + 2] : [pied, pied + 2]) {
    K.bloque(i);
    fA[i] = 0;
    fB[i] = 0;
  }
  K.factorise();
  const uA = K.resout(fA);
  const uB = K.resout(fB);

  /** Forces de l'appui sur le mur pour un champ de deplacement. */
  const forceAppui = (x: Float64Array, ap: (typeof appuisN)[number]): { Fx: number; Fz: number; T: number } => {
    if (ap.a.effortImpose !== null) return { Fx: 0, Fz: 0, T: 0 };
    const T = -ap.k * (x[ap.n * 3] * ap.ex + x[ap.n * 3 + 2] * ap.ez);
    return { Fx: T * ap.ex, Fz: T * ap.ez, T };
  };

  const statique = (x: Float64Array, ch: Extremites, avecPonctuel: boolean): { Vf: number; Mf: number } => {
    let V = 0;
    let M = 0;
    for (let n = 0; n < nn; n += 1) {
      for (const ap of appuisN) {
        if (ap.n !== n) continue;
        V += forceAppui(x, ap).Fx;
        if (avecPonctuel && ap.a.effortImpose !== null) {
          V += (((ap.a.type === 'tirant' ? 1 : -1) * ap.a.effortImpose) / ap.a.entraxe) * ap.ex;
        }
      }
      if (avecPonctuel) {
        for (const f of forces) {
          if (f.n === n) {
            V += f.H;
            M -= f.M;
          }
        }
      }
      if (n < ne) {
        const l = zn[n + 1] - zn[n];
        M += V * l + (l * l * (2 * ch.q1[n] + ch.q2[n])) / 6;
        V += (l * (ch.q1[n] + ch.q2[n])) / 2;
      }
    }
    return { Vf: V, Mf: M };
  };
  const SA = statique(uA, A, true);
  const SB = statique(uB, B, false);
  const denom = encastre ? SB.Mf : SB.Vf;
  const num = encastre ? SA.Mf : SA.Vf;
  const phi = denom === 0 ? 0 : Math.max(0, -num / denom);

  const u = uA.map((v, i) => v + phi * uB[i]);
  const courbes: Courbes = { z: [], q: [], V: [], M: [], N: [] };
  let V = 0;
  let M = 0;
  let N = 0;
  const appuis: ResultatAppui[] = [];
  for (let n = 0; n < nn; n += 1) {
    for (const ap of appuisN) {
      if (ap.n !== n) continue;
      const fa = forceAppui(uA, ap);
      const fb = forceAppui(uB, ap);
      let T = fa.T + phi * fb.T;
      if (ap.a.effortImpose !== null) T = ((ap.a.type === 'tirant' ? 1 : -1) * ap.a.effortImpose) / ap.a.entraxe;
      const Fx = T * ap.ex;
      V += Fx;
      N += T * ap.ez;
      const a = ap.a;
      const Rh = -Fx;
      const c = a.lierne === 'continue' ? 10 : a.lierne === 'deux-appuis' ? 8 : 0;
      appuis.push({
        nom: a.nom,
        z: zn[n],
        Rh,
        axial: T * a.entraxe,
        Mlierne: c === 0 ? 0 : (Math.abs(Rh) * a.entraxe * a.entraxe) / c,
      });
    }
    for (const f of forces) {
      if (f.n === n) {
        V += f.H;
        M -= f.M;
      }
    }
    if (n < ne) {
      const l = zn[n + 1] - zn[n];
      const q1 = A.q1[n] + phi * B.q1[n];
      const q2 = A.q2[n] + phi * B.q2[n];
      courbes.z.push(zn[n], zn[n + 1]);
      courbes.q.push(q1, q2);
      courbes.V.push(V);
      courbes.M.push(M);
      courbes.N.push(N);
      M += V * l + (l * l * (2 * q1 + q2)) / 6;
      V += (l * (q1 + q2)) / 2;
      courbes.V.push(V);
      courbes.M.push(M);
      courbes.N.push(N);
    }
  }
  const w: number[] = [];
  for (let n = 0; n < nn; n += 1) w.push(u[n * 3] * 1000);
  return { phi, courbes, nz: zn, w, appuis };
}

// -------------------------------------------------------------------------------------------------
// Etat pour un degre d'encastrement, longueur minimale
// -------------------------------------------------------------------------------------------------

function structureEncastree(H: number, L: number): number {
  return H + (L - H) / 1.2;
}

function etatPour(d: DonneesParoi, j: Jeu, L: number, g: number): Etat {
  if (g <= 0) return resoudrePortique(d, j, L, L, false);
  if (g >= 1) return resoudrePortique(d, j, structureEncastree(d.H, L), L, true);
  const e0 = resoudrePortique(d, j, L, L, false);
  const e1 = resoudrePortique(d, j, structureEncastree(d.H, L), L, true);
  const lire = (z: number, c: Courbes, v: number[]): number => {
    if (z > c.z[c.z.length - 1]) return 0;
    for (let i = 1; i < c.z.length; i += 1) {
      if (z <= c.z[i]) {
        const t = c.z[i] === c.z[i - 1] ? 0 : (z - c.z[i - 1]) / (c.z[i] - c.z[i - 1]);
        return v[i - 1] + t * (v[i] - v[i - 1]);
      }
    }
    return 0;
  };
  const mel = (a: number, b: number): number => (1 - g) * a + g * b;
  const c0 = e0.courbes;
  const c1 = e1.courbes;
  return {
    phi: mel(e0.phi, e1.phi),
    courbes: {
      z: c0.z,
      q: c0.q.map((v, i) => mel(v, lire(c0.z[i], c1, c1.q))),
      V: c0.V.map((v, i) => mel(v, lire(c0.z[i], c1, c1.V))),
      M: c0.M.map((v, i) => mel(v, lire(c0.z[i], c1, c1.M))),
      N: c0.N.map((v, i) => mel(v, lire(c0.z[i], c1, c1.N))),
    },
    nz: e0.nz,
    w: e0.w.map((v, i) => {
      const z = e0.nz[i];
      if (z > e1.nz[e1.nz.length - 1]) return mel(v, 0);
      let k = 0;
      while (k < e1.nz.length - 2 && e1.nz[k + 1] < z) k += 1;
      const t = (z - e1.nz[k]) / (e1.nz[k + 1] - e1.nz[k]);
      return mel(v, e1.w[k] + t * (e1.w[k + 1] - e1.w[k]));
    }),
    appuis: e0.appuis.map((a, i) => ({
      ...a,
      Rh: mel(a.Rh, e1.appuis[i].Rh),
      axial: mel(a.axial, e1.appuis[i].axial),
      Mlierne: mel(a.Mlierne, e1.appuis[i].Mlierne),
    })),
  };
}

function ficheLimite(d: DonneesParoi, j: Jeu, encastre: boolean): number | null {
  const phiDe = (L: number): number => (encastre
    ? resoudrePortique(d, j, structureEncastree(d.H, L), L, true).phi
    : resoudrePortique(d, j, L, L, false).phi);
  const minimum = Math.max(d.H + 0.1, ...d.appuis.map((a) => a.z + 0.2));
  let bas = minimum;
  let haut = d.H + 60;
  if (phiDe(haut) > 1) return null;
  if (phiDe(bas) <= 1) return bas - d.H;
  for (let k = 0; k < 18; k += 1) {
    const m = (bas + haut) / 2;
    if (phiDe(m) > 1) bas = m;
    else haut = m;
  }
  return (bas + haut) / 2 - d.H;
}

function ficheMinimale(d: DonneesParoi, j: Jeu): number | null {
  const g = d.degreEncastrement;
  if (g <= 0) return ficheLimite(d, j, false);
  if (g >= 1) return ficheLimite(d, j, true);
  const d0 = ficheLimite(d, j, false);
  const d1 = ficheLimite(d, j, true);
  return d0 === null || d1 === null ? null : (1 - g) * d0 + g * d1;
}

// -------------------------------------------------------------------------------------------------
// Controles et verification
// -------------------------------------------------------------------------------------------------

function controler(d: DonneesParoi): void {
  const pos = (v: number, nom: string): void => {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${nom} : valeur strictement positive attendue.`);
  };
  pos(d.H, 'Hauteur retenue');
  pos(d.L, 'Longueur de la paroi');
  pos(d.EI, 'Rigidité EI');
  pos(d.EA, 'Rigidité EA');
  if (d.L <= d.H) throw new Error('La longueur de la paroi doit dépasser la hauteur retenue.');
  if (d.couches.length === 0) throw new Error('Au moins une couche est requise.');
  for (const c of d.couches) {
    pos(c.h, `${c.nom} : épaisseur`);
    pos(c.gamma, `${c.nom} : poids volumique`);
    pos(c.gammaSat, `${c.nom} : poids volumique saturé`);
    if (!Number.isFinite(c.phi) || c.phi < 0 || c.phi >= 60) throw new Error(`${c.nom} : angle de frottement entre 0 et 60°.`);
    if (!Number.isFinite(c.c) || c.c < 0) throw new Error(`${c.nom} : cohésion négative ou invalide.`);
    if (c.phi === 0 && c.c === 0) throw new Error(`${c.nom} : un sol sans frottement exige une cohésion.`);
    for (const k of [c.kDeltaA, c.kDeltaP]) {
      if (!Number.isFinite(k) || k < 0 || k > 1) throw new Error(`${c.nom} : k_tan δ entre 0 et 1 (7.5.2).`);
    }
  }
  if (!(d.partK0 >= 0 && d.partK0 <= 1)) throw new Error('Part de K0 : entre 0 et 1.');
  if (!(d.degreEncastrement >= 0 && d.degreEncastrement <= 1)) throw new Error('Degré d’encastrement : entre 0 et 1.');
  for (const a of d.appuis) {
    pos(a.entraxe, `${a.nom} : entraxe`);
    if (!(a.z >= 0 && a.z < d.H)) throw new Error(`${a.nom} : niveau entre la tête et le fond de fouille.`);
    if (a.effortImpose !== null && !(a.effortImpose > 0)) throw new Error(`${a.nom} : effort imposé strictement positif.`);
    if ((a.EA === null) !== (a.longueur === null)) throw new Error(`${a.nom} : EA et longueur vont ensemble.`);
    if (a.EA !== null && !(a.EA > 0 && (a.longueur ?? 0) > 0)) throw new Error(`${a.nom} : EA et longueur strictement positifs.`);
  }
  const portants = d.appuis.filter((a) => a.effortImpose === null);
  if (portants.length === 0 && d.degreEncastrement < 1) {
    throw new Error('Sans appui porteur, le pied doit être encastré à 100 % (console).');
  }
  const b = d.charges;
  for (const c of b) {
    if (c.type === 'bande' && !(c.a >= 0 && c.b > 0)) throw new Error('Charge en bande : distance positive et largeur strictement positive.');
    if (c.type === 'pression' && !(c.z2 > c.z1)) throw new Error('Pression imposée : z2 doit dépasser z1.');
  }
}

function extremum(v: number[]): number {
  let m = 0;
  for (const x of v) if (Math.abs(x) > m) m = Math.abs(x);
  return m;
}

export function verifierParoi(d: DonneesParoi): ResultatParoi {
  controler(d);
  const alertes: string[] = [];
  const liste = jeux(d.norme).map((j) => appliquerModifications(j, d.modifications));
  const combinaisons: ResultatCombinaison[] = liste.map((j) => {
    const e = etatPour(d, j, d.L, d.degreEncastrement);
    const f = j.gE;
    const courbes: Courbes = {
      z: e.courbes.z,
      q: e.courbes.q.map((v) => v * f),
      V: e.courbes.V.map((v) => v * f),
      M: e.courbes.M.map((v) => v * f),
      N: e.courbes.N.map((v) => v * f),
    };
    return {
      nom: j.nom,
      mobilisation: e.phi,
      ficheMinimale: ficheMinimale(d, j),
      Mmax: extremum(courbes.M),
      Vmax: extremum(courbes.V),
      Nmax: extremum(courbes.N),
      appuis: e.appuis.map((a) => ({ ...a, Rh: a.Rh * f, axial: a.axial * f, Mlierne: a.Mlierne * f })),
      courbes,
      coefficients: j.coefficients,
    };
  });
  const g = combinaisons.reduce((a, b) => (b.mobilisation > a.mobilisation ? b : a));
  const es = etatPour(d, SERVICE, d.L, d.degreEncastrement);
  let wMax = 0;
  let zWMax = 0;
  es.w.forEach((v, i) => {
    if (Math.abs(v) > Math.abs(wMax)) {
      wMax = v;
      zWMax = es.nz[i];
    }
  });
  const gradient = gradientHydraulique(d, d.L);
  const gammaPrime = coucheEn(d, d.L - 1e-6).gammaSat - GAMMA_W;
  if (gradient >= gammaPrime / GAMMA_W) {
    alertes.push(`Gradient ascendant ${gradient.toFixed(2)} supérieur au gradient critique : vérifier le renard hydraulique.`);
  }
  if (g.mobilisation > 1) alertes.push('Butée insuffisante : augmenter la fiche.');
  if (d.couches.some((c) => c.phi > 40)) alertes.push('φ supérieur à 40° : coefficients de butée à apprécier avec prudence (7.5.3.3).');
  if (d.eau.zTerre > 0) alertes.push('Le 7.4.1 demande une situation accidentelle avec nappe en surface, sauf drainage ou impossibilité : à vérifier.');
  if (d.partK0 === 0 && d.appuis.length > 0 && d.redistribution.forme === 'aucune') {
    alertes.push('Paroi appuyée sans redistribution : la pression réelle se reporte vers les appuis (D.8, 7.5.3.1).');
  }
  alertes.push('Déplacements : ligne élastique de la paroi, indicative ; l’équilibre limite ignore le phasage et la rigidité du sol (D.8).');
  return {
    generation: d.norme.generation,
    combinaisons,
    gouvernant: { combinaison: g.nom, mobilisation: g.mobilisation },
    Md: Math.max(...combinaisons.map((c) => c.Mmax)),
    Vd: Math.max(...combinaisons.map((c) => c.Vmax)),
    service: { z: es.nz, w: es.w, wMax, zWMax, wTete: es.w[0] },
    gradient,
    alertes,
  };
}

/**
 * La saisie, en chaines, et sa conversion en donnees du noyau. PUR : aucun calcul ici, le noyau fait foi.
 * Les champs d'un choix inactif restent en memoire ; basculer ne change aucune valeur saisie.
 */

import { lireNombre, nombreAffiche } from 'aedificium-ui';
import {
  verifierParoi,
  type Appui,
  type Charge,
  type Couche,
  type DonneesParoi,
  type FormeRedistribution,
  type Modifications,
  type NormeParoi,
  type ResultatParoi,
} from '../../src/parois';

export interface SaisieCouche {
  nom: string; h: string; gamma: string; gammaSat: string; phi: string; c: string;
  kDeltaA: string; kDeltaP: string; Ka: string; Kp: string;
}

export interface SaisieAppui {
  nom: string; type: string; z: string; inclinaison: string; entraxe: string;
  effort: string; EA: string; longueur: string; lierne: string;
}

export interface SaisieCharge {
  type: string; nature: string; q: string; a: string; b: string; rigide: boolean;
  H: string; M: string; z: string; z1: string; z2: string; p1: string; p2: string;
}

export interface Saisie {
  H: string; L: string; EI: string; EA: string; degre: string;
  partK0: string; forme: string; polygone: string;
  zTerre: string; zFouille: string; ecoulement: boolean;
  couches: SaisieCouche[]; appuis: SaisieAppui[]; charges: SaisieCharge[];
  generation: '1re' | '2e'; cc: string; approche2: string; profil: string; approche1: string; risque: string;
  gG: string; gQ: string; gPhi: string; gC: string; gCu: string; gRe: string;
}

export interface Calcul { saisie: Saisie; donnees: DonneesParoi }
export type Resultat = ResultatParoi;
export type Lecture = { ok: true; calcul: Calcul } | { ok: false; message: string };

const FORMAT = 'parois/1';

const couche = (nom: string, h: string, gamma: string, gammaSat: string, phi: string, c: string): SaisieCouche =>
  ({ nom, h, gamma, gammaSat, phi, c, kDeltaA: '2/3', kDeltaP: '2/3', Ka: '', Kp: '' });

export const nouvelAppui = (n: number): SaisieAppui =>
  ({ nom: `A${n}`, type: 'tirant', z: '1,2', inclinaison: '20', entraxe: '2,5', effort: '', EA: '', longueur: '', lierne: 'continue' });

export const nouvelleCharge = (): SaisieCharge =>
  ({ type: 'repartie', nature: 'variable', q: '10', a: '1', b: '2', rigide: true, H: '10', M: '10', z: '0', z1: '0', z2: '1', p1: '5', p2: '5' });

/** Le cas de la maquette, nombres ecrits a la francaise. */
export function saisieParDefaut(): Saisie {
  return {
    H: '6', L: '10', EI: '125000', EA: '5000000', degre: '0',
    partK0: '0', forme: 'aucune', polygone: '0:1; 1:1',
    zTerre: '2,5', zFouille: '6,5', ecoulement: true,
    couches: [
      couche('Remblai', '3', '18', '20', '30', '0'),
      couche('Limon argileux', '4', '19', '20', '26', '5'),
      couche('Sable dense', '30', '19', '21', '35', '0'),
    ],
    appuis: [nouvelAppui(1)],
    charges: [nouvelleCharge()],
    generation: '2e', cc: 'CC2', approche2: 'a+b', profil: 'recommande', approche1: 'DA1', risque: 'normal',
    gG: '', gQ: '', gPhi: '', gC: '', gCu: '', gRe: '',
  };
}

class Refus extends Error {}

function nb(brut: string, champ: string): number {
  const v = lireNombre(brut);
  if (v === null) throw new Refus(`Le champ « ${champ} » n’est pas un nombre lisible (« ${brut} »).`);
  return v;
}

const vide = (brut: string): boolean => brut.trim() === '';
const option = (brut: string, champ: string): number | null => (vide(brut) ? null : nb(brut, champ));

/** Rapport saisi en decimal ou en fraction (2/3). */
function rapport(brut: string, champ: string): number {
  const f = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(brut);
  return f !== null ? Number(f[1]) / Number(f[2]) : nb(brut, champ);
}

function lireCouche(c: SaisieCouche): Couche {
  const n = (brut: string, champ: string) => nb(brut, `${c.nom} : ${champ}`);
  return {
    nom: c.nom,
    h: n(c.h, 'épaisseur'),
    gamma: n(c.gamma, 'γ'),
    gammaSat: n(c.gammaSat, 'γ_sat'),
    phi: n(c.phi, 'φ'),
    c: n(c.c, 'c'),
    kDeltaA: rapport(c.kDeltaA, `${c.nom} : k_tan δ actif`),
    kDeltaP: rapport(c.kDeltaP, `${c.nom} : k_tan δ passif`),
    KaImpose: option(c.Ka, `${c.nom} : K_a imposé`),
    KpImpose: option(c.Kp, `${c.nom} : K_p imposé`),
  };
}

function lireAppui(a: SaisieAppui): Appui {
  const n = (brut: string, champ: string) => nb(brut, `${a.nom} : ${champ}`);
  return {
    nom: a.nom,
    type: a.type === 'buton' ? 'buton' : 'tirant',
    z: n(a.z, 'niveau'),
    inclinaison: n(a.inclinaison, 'inclinaison'),
    entraxe: n(a.entraxe, 'entraxe'),
    EA: option(a.EA, `${a.nom} : EA`),
    longueur: option(a.longueur, `${a.nom} : longueur`),
    effortImpose: option(a.effort, `${a.nom} : effort imposé`),
    lierne: a.lierne === 'continue' || a.lierne === 'deux-appuis' ? a.lierne : null,
  };
}

function lireCharge(c: SaisieCharge, i: number): Charge {
  const n = (brut: string, champ: string) => nb(brut, `Charge ${i + 1} : ${champ}`);
  const nature = c.nature === 'permanente' ? 'permanente' as const : 'variable' as const;
  if (c.type === 'bande') return { type: 'bande', nature, q: n(c.q, 'q'), a: n(c.a, 'distance'), b: n(c.b, 'largeur'), rigide: c.rigide };
  if (c.type === 'force') return { type: 'force', nature, z: n(c.z, 'niveau'), H: n(c.H, 'H') };
  if (c.type === 'moment') return { type: 'moment', nature, z: n(c.z, 'niveau'), M: n(c.M, 'M') };
  if (c.type === 'pression') return { type: 'pression', nature, z1: n(c.z1, 'z₁'), z2: n(c.z2, 'z₂'), p1: n(c.p1, 'p₁'), p2: n(c.p2, 'p₂') };
  return { type: 'repartie', nature, q: n(c.q, 'q') };
}

/** Texte « 0:1; 0,5:2; 1:0 » en points (z/H, valeur). */
function lirePolygone(brut: string): [number, number][] {
  return brut.split(';').filter((p) => p.trim() !== '').map((p) => {
    const [x, y] = p.split(':');
    if (y === undefined) throw new Refus(`Polygone : point « ${p.trim()} » illisible, attendu z/H:valeur.`);
    return [nb(x, 'polygone, z/H'), nb(y, 'polygone, valeur')];
  });
}

const FORMES: readonly FormeRedistribution[] = ['aucune', 'rectangle', 'triangle-haut', 'triangle-milieu', 'triangle-bas', 'trapeze', 'polygone'];

function lireNorme(s: Saisie): NormeParoi {
  if (s.generation === '2e') {
    const cc = s.cc === 'CC1' || s.cc === 'CC3' ? s.cc : 'CC2';
    return { generation: 2, cc, approche: s.approche2 === 'd' ? 'd' : 'a+b' };
  }
  if (s.profil === 'anb') return { generation: 1, profil: 'anb', risque: s.risque === 'faible' || s.risque === 'eleve' ? s.risque : 'normal' };
  return { generation: 1, profil: 'recommande', approche: s.approche1 === 'DA2' || s.approche1 === 'DA3' ? s.approche1 : 'DA1' };
}

function lireModifications(s: Saisie): Modifications | undefined {
  const m: Modifications = {};
  const champs: [keyof Modifications, string, string][] = [
    ['gG', s.gG, 'γ_G'], ['gQ', s.gQ, 'γ_Q'], ['gPhi', s.gPhi, 'γ_tan φ'],
    ['gC', s.gC, 'γ_c'], ['gCu', s.gCu, 'γ_cu'], ['gRe', s.gRe, 'γ_Re'],
  ];
  for (const [cle, brut, nom] of champs) {
    const v = option(brut, nom);
    if (v !== null) {
      if (!(v > 0)) throw new Refus(`${nom} : valeur strictement positive attendue.`);
      m[cle] = v;
    }
  }
  return Object.keys(m).length === 0 ? undefined : m;
}

export function lireSaisie(s: Saisie): Lecture {
  try {
    const forme = FORMES.includes(s.forme as FormeRedistribution) ? (s.forme as FormeRedistribution) : 'aucune';
    const donnees: DonneesParoi = {
      H: nb(s.H, 'Hauteur retenue H'),
      L: nb(s.L, 'Longueur de la paroi'),
      EI: nb(s.EI, 'Rigidité EI'),
      EA: nb(s.EA, 'Rigidité EA'),
      degreEncastrement: nb(s.degre, 'Degré d’encastrement') / 100,
      partK0: nb(s.partK0, 'Part de K_0'),
      redistribution: forme === 'polygone' ? { forme, polygone: lirePolygone(s.polygone) } : { forme },
      eau: { zTerre: nb(s.zTerre, 'Nappe côté terre'), zFouille: nb(s.zFouille, 'Nappe côté fouille'), ecoulement: s.ecoulement },
      couches: s.couches.map(lireCouche),
      appuis: s.appuis.map(lireAppui),
      charges: s.charges.map(lireCharge),
      norme: lireNorme(s),
      modifications: lireModifications(s),
    };
    return { ok: true, calcul: { saisie: s, donnees } };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, message: e.message };
    throw e;
  }
}

export const verifier = (c: Calcul): Resultat => verifierParoi(c.donnees);

/** Longueur qui donne la plus grande fiche minimale des combinaisons, arrondie aux 5 cm superieurs. */
export function longueurProposee(calcul: Calcul, r: Resultat): string | null {
  const fiches = r.combinaisons.map((c) => c.ficheMinimale);
  if (fiches.some((f) => f === null)) return null;
  const f = Math.max(...(fiches as number[]));
  return nombreAffiche(Math.ceil((calcul.donnees.H + f) * 20 - 1e-6) / 20, 2);
}

export const serialiser = (s: Saisie): string => JSON.stringify({ format: FORMAT, ...s }, null, 2);

function fusion<T extends object>(defaut: T, brut: unknown): T {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const r = { ...defaut } as Record<string, unknown>;
  for (const k of Object.keys(r)) if (typeof o[k] === typeof r[k]) r[k] = o[k];
  return r as T;
}

/** Relit un document enregistre ; les champs absents prennent la valeur par defaut. */
export function relire(contenu: string): Saisie {
  const brut = JSON.parse(contenu) as Record<string, unknown>;
  if (brut.format !== FORMAT) throw new Error(`Format de fichier inconnu (« ${String(brut.format)} ») : attendu « ${FORMAT} ».`);
  const d = saisieParDefaut();
  const liste = <T extends object>(v: unknown, modele: T, defaut: T[]): T[] =>
    (Array.isArray(v) ? v.map((x) => fusion(modele, x)) : defaut);
  const { couches: _c, appuis: _a, charges: _h, ...simples } = d;
  return {
    ...fusion(simples, brut),
    generation: brut.generation === '1re' ? '1re' : '2e',
    couches: (() => { const l = liste(brut.couches, d.couches[0], d.couches); return l.length > 0 ? l : d.couches; })(),
    appuis: liste(brut.appuis, d.appuis[0], d.appuis),
    charges: liste(brut.charges, d.charges[0], d.charges),
  };
}

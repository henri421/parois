/**
 * Paroi phasee (lot F, PLAN-phasage.md). Chaque phase de terrassement est un etat d'equilibre limite
 * INDEPENDANT : le noyau `verifierParoi` (et `verifierFond`) est appele sur les donnees de la phase,
 * sans historique des deplacements. Ce module ne calcule rien d'autre que des enveloppes.
 * PUR : aucune entree-sortie.
 */

import { verifierParoi, type DonneesParoi, type ResultatParoi } from './parois';
import { verifierFond, type ResultatFond } from './fond';

export interface Phase {
  nom: string;
  /** Fond de fouille de la phase (m, profondeur depuis la tete). */
  H: number;
  /** Noms des appuis en place. */
  appuis: string[];
  /** Eau cote fouille (m, profondeur). */
  zEau: number;
}

export interface ResultatPhase {
  phase: Phase;
  resultat: ResultatParoi;
  fond: ResultatFond;
}

export interface EnveloppeAppui {
  nom: string;
  /** Reaction horizontale maximale (kN/m), en valeur absolue. */
  Rh: number;
  /** Effort axial par appui (kN) de la meme combinaison. */
  axial: number;
  phase: string;
  combinaison: string;
}

export interface ResultatPhases {
  phases: ResultatPhase[];
  determinante: { phase: string; combinaison: string; mobilisation: number };
  /** Longueur de paroi requise : max(fond + fiche minimale) ; null si une fiche n'existe pas. */
  longueurRequise: { valeur: number | null; phase: string };
  appuis: EnveloppeAppui[];
  Md: number;
  Vd: number;
  enveloppe: { z: number[]; Mmin: number[]; Mmax: number[]; Vmin: number[]; Vmax: number[] };
}

const EPS = 1e-9;
const arrondi = (x: number): number => Math.round(x * 1e6) / 1e6;

/**
 * Phases par defaut : creuser `surexcavation` sous chaque appui (pris dans l'ordre des profondeurs),
 * le poser, puis atteindre le fond final. L'eau cote fouille suit le fond sans remonter au-dessus de
 * la nappe cote terre ; la phase finale reprend l'eau saisie.
 */
export function phasesAutomatiques(d: DonneesParoi, surexcavation = 0.5): Phase[] {
  const tries = [...d.appuis].sort((a, b) => a.z - b.z);
  const enPlace = (poses: Set<string>): string[] => d.appuis.filter((a) => poses.has(a.nom)).map((a) => a.nom);
  const phases: Phase[] = [];
  const poses = new Set<string>();
  let precedent = 0;
  for (const a of tries) {
    const fond = arrondi(a.z + surexcavation);
    if (fond >= d.H - EPS) break;
    if (fond > precedent + EPS) {
      phases.push({ nom: '', H: fond, appuis: enPlace(poses), zEau: Math.max(fond, d.eau.zTerre) });
      precedent = fond;
    }
    poses.add(a.nom);
  }
  phases.push({ nom: '', H: d.H, appuis: d.appuis.map((a) => a.nom), zEau: d.eau.zFouille });
  return phases.map((p, i) => ({ ...p, nom: `Phase ${i + 1}` }));
}

/** Donnees du noyau pour une phase : fond, appuis en place et eau de la phase ; le reste est commun. */
export function donneesDePhase(d: DonneesParoi, p: Phase): DonneesParoi {
  if (!(Number.isFinite(p.H) && p.H > 0 && p.H <= d.H + EPS)) {
    throw new Error(`${p.nom} : fond de fouille entre 0 et ${d.H} m (fond final).`);
  }
  if (!(Number.isFinite(p.zEau) && p.zEau >= p.H - EPS)) {
    throw new Error(`${p.nom} : l’eau côté fouille ne peut pas être au-dessus du fond de fouille.`);
  }
  for (const nom of p.appuis) {
    const a = d.appuis.find((x) => x.nom === nom);
    if (a === undefined) throw new Error(`${p.nom} : appui inconnu « ${nom} ».`);
    if (a.z >= p.H) throw new Error(`${p.nom} : ${nom} est posé sous le fond de fouille de la phase.`);
  }
  const appuis = d.appuis.filter((a) => p.appuis.includes(a.nom));
  const portants = appuis.filter((a) => a.effortImpose === null);
  return {
    ...d,
    H: p.H,
    appuis,
    eau: { ...d.eau, zFouille: p.zEau },
    degreEncastrement: portants.length === 0 ? 1 : d.degreEncastrement,
  };
}

/** Valeurs d'une courbe polygonale en z ; deux valeurs aux sauts (points doubles). */
function valeursEn(zs: number[], v: number[], z: number): number[] {
  const r: number[] = [];
  for (let k = 0; k + 1 < zs.length; k++) {
    const z1 = zs[k];
    const z2 = zs[k + 1];
    if (z < Math.min(z1, z2) - EPS || z > Math.max(z1, z2) + EPS) continue;
    if (Math.abs(z2 - z1) < EPS) r.push(v[k], v[k + 1]);
    else r.push(v[k] + ((v[k + 1] - v[k]) * (z - z1)) / (z2 - z1));
  }
  return r;
}

export function verifierPhases(d: DonneesParoi, phases: Phase[]): ResultatPhases {
  const derniere = phases[phases.length - 1];
  const tous = d.appuis.map((a) => a.nom);
  if (derniere === undefined || Math.abs(derniere.H - d.H) > EPS
    || derniere.appuis.length !== tous.length || !tous.every((n) => derniere.appuis.includes(n))) {
    throw new Error('La dernière phase doit être la configuration finale (fond final, tous les appuis).');
  }
  const resultats: ResultatPhase[] = phases.map((p) => {
    const dp = donneesDePhase(d, p);
    const resultat = verifierParoi(dp);
    return { phase: p, resultat, fond: verifierFond(dp, resultat) };
  });

  let determinante = { phase: '', combinaison: '', mobilisation: -Infinity };
  let longueur: { valeur: number | null; phase: string } = { valeur: -Infinity, phase: '' };
  for (const x of resultats) {
    for (const k of x.resultat.combinaisons) {
      if (k.mobilisation > determinante.mobilisation) determinante = { phase: x.phase.nom, combinaison: k.nom, mobilisation: k.mobilisation };
      if (longueur.valeur === null) continue;
      if (k.ficheMinimale === null) longueur = { valeur: null, phase: x.phase.nom };
      else if (x.phase.H + k.ficheMinimale > longueur.valeur) longueur = { valeur: x.phase.H + k.ficheMinimale, phase: x.phase.nom };
    }
  }

  const appuis: EnveloppeAppui[] = d.appuis.map((a) => {
    let e: EnveloppeAppui = { nom: a.nom, Rh: -Infinity, axial: 0, phase: '', combinaison: '' };
    for (const x of resultats) for (const k of x.resultat.combinaisons) for (const r of k.appuis) {
      if (r.nom === a.nom && Math.abs(r.Rh) > e.Rh) e = { nom: a.nom, Rh: Math.abs(r.Rh), axial: r.axial, phase: x.phase.nom, combinaison: k.nom };
    }
    return e;
  });

  // Grille commune : pas regulier de L/200, plus tous les points des courbes (extremes exacts).
  const points = new Set<number>();
  for (let i = 0; i <= 200; i++) points.add(arrondi((d.L * i) / 200));
  for (const x of resultats) for (const k of x.resultat.combinaisons) for (const z of k.courbes.z) {
    if (z >= -EPS && z <= d.L + EPS) points.add(arrondi(z));
  }
  const z = [...points].sort((a, b) => a - b);
  const enveloppe = { z, Mmin: [] as number[], Mmax: [] as number[], Vmin: [] as number[], Vmax: [] as number[] };
  for (const zi of z) {
    const M: number[] = [];
    const V: number[] = [];
    for (const x of resultats) for (const k of x.resultat.combinaisons) {
      M.push(...valeursEn(k.courbes.z, k.courbes.M, zi));
      V.push(...valeursEn(k.courbes.z, k.courbes.V, zi));
    }
    enveloppe.Mmin.push(M.length > 0 ? Math.min(...M) : 0);
    enveloppe.Mmax.push(M.length > 0 ? Math.max(...M) : 0);
    enveloppe.Vmin.push(V.length > 0 ? Math.min(...V) : 0);
    enveloppe.Vmax.push(V.length > 0 ? Math.max(...V) : 0);
  }

  return {
    phases: resultats,
    determinante,
    longueurRequise: longueur.valeur === -Infinity ? { valeur: null, phase: '' } : longueur,
    appuis,
    Md: Math.max(...resultats.map((x) => x.resultat.Md)),
    Vd: Math.max(...resultats.map((x) => x.resultat.Vd)),
    enveloppe,
  };
}

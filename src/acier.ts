/**
 * Verification acier des profils de berlinoise, des butons et des liernes (EN 1993-1-1, 6.2 et 6.3)
 * par le moteur de sections-ec3, a partir des efforts de calcul de la paroi.
 *
 * Efforts retenus (enveloppe des combinaisons, choix de l'outil) :
 * - profil de berlinoise : M_d, V_d et N_max par metre multiplies par l'entraxe des profils ;
 *   longueurs de flambement et de deversement egales a la longueur de la paroi ;
 * - buton : compression |effort axial| maximale, sans flexion (poids propre neglige) ;
 *   longueurs egales a la longueur libre de l'appui ;
 * - lierne : M de la lierne, V = 0,6 R_h.a (continue) ou 0,5 R_h.a (deux appuis), N nul ;
 *   longueurs egales a l'entraxe a.
 * Deversement non empeche, C1 = 1 (moment uniforme), charge au centre de cisaillement.
 */

import { ec3Recommande, profilCatalogue, verifierElement, type Nuance, type ResultatElement } from 'sections-ec3';
import type { DonneesParoi, ResultatParoi } from './parois';

export interface ProfilAcier {
  /** Nom du catalogue de sections-ec3, profil en I lamine (HEB 300, IPE 270...). */
  profil: string;
  nuance: Nuance;
}

export interface DonneesAcier {
  /** Profils de berlinoise et leur entraxe (m) ; null = paroi non verifiee. */
  paroi: (ProfilAcier & { entraxe: number }) | null;
  /** Par appui, dans l'ordre de DonneesParoi.appuis ; ignore pour un tirant. */
  butons: (ProfilAcier | null)[];
  /** Par appui ; ignore sans lierne. */
  liernes: (ProfilAcier | null)[];
}

export interface ElementAcier {
  type: 'paroi' | 'buton' | 'lierne';
  /** Nom de l'appui ; vide pour la paroi. */
  nom: string;
  profil: string;
  nuance: Nuance;
  /** Compression positive (kN), moment (kN.m), tranchant (kN). */
  N: number;
  M: number;
  V: number;
  /** Longueur de flambement et de deversement (m). */
  longueur: number;
  resultat: ResultatElement | null;
  /** Plus grand taux des verifications applicables ; null en cas d'erreur. */
  taux: number | null;
  /** 'profil' : absent du catalogue ; 'longueur' : buton sans longueur libre. */
  erreur: 'profil' | 'longueur' | null;
}

function calculer(e: Omit<ElementAcier, 'resultat' | 'taux' | 'erreur'>): ElementAcier {
  let section;
  try {
    section = profilCatalogue(e.profil);
  } catch {
    return { ...e, resultat: null, taux: null, erreur: 'profil' };
  }
  if (!(e.longueur > 0)) return { ...e, resultat: null, taux: null, erreur: 'longueur' };
  const mm = e.longueur * 1000;
  const resultat = verifierElement({
    profil: section, nuance: e.nuance, N: e.N, My: e.M, Mz: 0, Vz: e.V, Vy: 0,
    Lcr_y: mm, Lcr_z: mm, L_LT: mm, deversementEmpeche: false,
    diagrammeLT: { type: 'lineaire', psi: 1 }, pointApplication: 'centre', McrSaisi: null,
    diagrammeY: { type: 'lineaire', psi: 1 }, diagrammeZ: { type: 'lineaire', psi: 1 },
  }, ec3Recommande());
  const taux = resultat.verifications.filter((v) => v.applicable && v.taux !== null).map((v) => v.taux as number);
  return { ...e, resultat, taux: taux.length > 0 ? Math.max(...taux) : 0, erreur: null };
}

export function verifierAcier(d: DonneesParoi, r: ResultatParoi, a: DonneesAcier): ElementAcier[] {
  const sortie: ElementAcier[] = [];
  const max = (f: (c: ResultatParoi['combinaisons'][number]) => number): number => Math.max(...r.combinaisons.map(f));
  if (a.paroi !== null) {
    const e = a.paroi.entraxe;
    sortie.push(calculer({
      type: 'paroi', nom: '', profil: a.paroi.profil, nuance: a.paroi.nuance,
      N: max((c) => c.Nmax) * e, M: r.Md * e, V: r.Vd * e, longueur: d.L,
    }));
  }
  d.appuis.forEach((ap, i) => {
    const b = a.butons[i] ?? null;
    if (ap.type !== 'buton' || b === null) return;
    sortie.push(calculer({
      type: 'buton', nom: ap.nom, profil: b.profil, nuance: b.nuance,
      N: max((c) => Math.abs(c.appuis[i].axial)), M: 0, V: 0, longueur: ap.longueur ?? 0,
    }));
  });
  d.appuis.forEach((ap, i) => {
    const l = a.liernes[i] ?? null;
    if (ap.lierne === null || l === null) return;
    const k = ap.lierne === 'continue' ? 0.6 : 0.5;
    sortie.push(calculer({
      type: 'lierne', nom: ap.nom, profil: l.profil, nuance: l.nuance,
      N: 0, M: max((c) => c.appuis[i].Mlierne), V: max((c) => k * Math.abs(c.appuis[i].Rh) * ap.entraxe), longueur: ap.entraxe,
    }));
  });
  return sortie;
}

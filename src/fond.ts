/**
 * Fond de fouille et equilibre vertical d'une paroi encastree.
 *
 * - Soulevement hydraulique (HYD) au pied, cote fouille, en presence d'ecoulement : colonne de sol
 *   entre le fond de fouille et le pied, surpression Δu = i.γw.(L − z_fouille) avec le gradient uniforme
 *   du noyau. 2e generation : EN 1997-1:2024, 8.1.4.2, Δu ≤ γHYD.σ′v0 (γHYD = 0,67, note 2).
 *   1re generation : EN 1997-1:2004, 2.4.7.5, γG;dst = 1,35 sur la force d'ecoulement et γG;stb = 0,90
 *   sur le poids deja-jauge (ANB 2022, tableau A.17, sans ecart a la valeur recommandee).
 * - Soulevement du fond en sol fin non draine (EN 1997-3:2025, 7.6.6 et D.7, formules D.24 a D.26,
 *   Bjerrum et Eide) : γ.He + qa ≤ Nc.cu, avec les coefficients de chaque combinaison (actions, γcu,
 *   γR = γRe). En 1re generation, la meme methode est appliquee, choix de l'outil.
 * - Equilibre vertical (EN 1997-3:2025, 7.6.4 et D.12 ; EN 1997-1:2004, 9.7.5) : la composante
 *   verticale de la butee mobilisee, dirigee vers le haut, doit etre equilibree par les forces dirigees
 *   vers le bas : composantes verticales des appuis, composante verticale de la poussee, poids propre.
 *   Integration sur toute la hauteur, choix de l'outil.
 */

import {
  GAMMA_W, coucheEn, gradientHydraulique, jeuxParoi, poids, pressionsEn,
  type DonneesParoi, type ResultatParoi,
} from './parois';

const rad = (d: number): number => (d * Math.PI) / 180;

export interface VerificationHyd {
  gradient: number;
  /** Surpression au pied cote fouille (kPa). */
  du: number;
  /** Contrainte effective verticale au pied cote fouille, sans ecoulement (kPa). */
  sigma: number;
  Ed: number;
  Rd: number;
  taux: number;
}

export interface FondCombinaison {
  combinaison: string;
  Nc: number;
  /** cu de calcul (kPa). */
  cu: number;
  Ed: number;
  Rd: number;
  taux: number;
}

export type VerificationFondFouille =
  | { applicable: false; motif: 'draine' | 'largeur' }
  | { applicable: true; combinaisons: FondCombinaison[] };

export interface VerticalCombinaison {
  combinaison: string;
  /** Composantes verticales par metre de paroi (kN/m), positives dans le sens indique. */
  appuisBas: number;
  pousseeBas: number;
  poidsParoi: number;
  buteeHaut: number;
  taux: number;
  /** Force nette vers le bas a reprendre en pied (kN/m), nulle si negative. */
  netBas: number;
}

export interface ResultatFond {
  /** null sans ecoulement. */
  hyd: VerificationHyd | null;
  fond: VerificationFondFouille;
  vertical: VerticalCombinaison[];
}

/** Coefficient de Bjerrum et Eide, formules D.25 et D.26 ; longueur nulle = fouille infinie. */
export function facteurNc(He: number, B: number, longueur: number | null): number {
  const forme = 1 + 0.2 * (longueur === null ? 0 : B / longueur);
  return He / B <= 2.5 ? 5 * (1 + (0.2 * He) / B) * forme : 7.5 * forme;
}

function hyd(d: DonneesParoi): VerificationHyd | null {
  const i = gradientHydraulique(d, d.L);
  if (i <= 0) return null;
  const { zFouille } = d.eau;
  const du = i * GAMMA_W * (d.L - zFouille);
  const sigma = poids(d, d.H, d.L, zFouille) + GAMMA_W * Math.max(0, d.H - zFouille) - GAMMA_W * (d.L - zFouille);
  const [Ed, Rd] = d.norme.generation === 2 ? [du, 0.67 * sigma] : [1.35 * du, 0.9 * sigma];
  return { gradient: i, du, sigma, Ed, Rd, taux: Rd > 0 ? Ed / Rd : Infinity };
}

function surcharges(d: DonneesParoi): { qG: number; qQ: number } {
  let qG = 0;
  let qQ = 0;
  for (const c of d.charges) {
    if (c.type !== 'repartie') continue;
    if (c.nature === 'permanente') qG += c.q;
    else qQ += c.q;
  }
  return { qG, qQ };
}

function fondFouille(d: DonneesParoi): VerificationFondFouille {
  const c = coucheEn(d, d.H + 1e-6);
  if (c.phi > 0) return { applicable: false, motif: 'draine' };
  const B = d.fouille?.B ?? null;
  if (B === null || !(B > 0)) return { applicable: false, motif: 'largeur' };
  const Nc = facteurNc(d.H, B, d.fouille?.longueur ?? null);
  const { qG, qQ } = surcharges(d);
  const poidsTerres = poids(d, 0, d.H, d.eau.zTerre);
  return {
    applicable: true,
    combinaisons: jeuxParoi(d).map((j) => {
      const Ed = j.gE * (j.gG * (poidsTerres + qG) + j.gQ * qQ);
      const cu = c.c / j.gCu;
      const Rd = (Nc * cu) / j.gRe;
      return { combinaison: j.nom, Nc, cu, Ed, Rd, taux: Ed / Rd };
    }),
  };
}

const PAS = 2000;

/** Integrale par points milieux d'une fonction de la profondeur sur [a, b]. */
function integrale(a: number, b: number, f: (z: number) => number): number {
  const h = (b - a) / PAS;
  let s = 0;
  for (let k = 0; k < PAS; k += 1) s += f(a + (k + 0.5) * h);
  return s * h;
}

function vertical(d: DonneesParoi, r: ResultatParoi): VerticalCombinaison[] {
  const G = d.poidsParoi ?? 0;
  return jeuxParoi(d).map((j, k) => {
    const res = r.combinaisons[k];
    const appuisBas = d.appuis.reduce((s, a, i) => s + (res.appuis[i].axial / a.entraxe) * Math.sin(rad(a.inclinaison)), 0);
    const tan = (phi: number, kDelta: number): number => kDelta * Math.tan(Math.atan(Math.tan(rad(phi)) / j.gPhi));
    const pousseeBas = j.gE * integrale(0, d.L, (z) => {
      const c = coucheEn(d, z);
      if (c.phi <= 0) return c.kDeltaA * (c.c / j.gCu);
      const p = pressionsEn(d, j, z, 0, d.L);
      return (j.gG * p.eG + j.gQ * p.eQ) * tan(c.phi, c.kDeltaA);
    });
    const buteeHaut = j.gE * (res.mobilisation / j.gRe) * integrale(d.H, d.L, (z) => {
      const c = coucheEn(d, z);
      if (c.phi <= 0) return c.kDeltaP * (c.c / j.gCu);
      return pressionsEn(d, j, z, 0, d.L).butee * tan(c.phi, c.kDeltaP);
    });
    const bas = appuisBas + pousseeBas + G;
    return {
      combinaison: j.nom, appuisBas, pousseeBas, poidsParoi: G, buteeHaut,
      taux: bas > 0 ? buteeHaut / bas : Infinity,
      netBas: Math.max(0, bas - buteeHaut),
    };
  });
}

export function verifierFond(d: DonneesParoi, r: ResultatParoi): ResultatFond {
  return { hyd: hyd(d), fond: fondFouille(d), vertical: vertical(d, r) };
}

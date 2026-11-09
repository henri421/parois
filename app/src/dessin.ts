/** Coupe de la paroi et diagrammes q, V, M, w sur une meme echelle verticale. PUR ; attributs en ligne : le SVG tient seul. */

import { echapper, nombreAffiche } from 'aedificium-ui';
import type { Calcul, Resultat } from './form';

export interface OptionsDessin {
  q: boolean; V: boolean; M: boolean; w: boolean; cotes: boolean;
  /** Nom de la combinaison tracee. */
  combinaison: string;
}

const HAUT = 60;
const TRACE = 420;
const MUR = 220;
const GAUCHE = 30;
const DROITE = 340;
const COLONNE = 140;
const COULEURS_SOL = ['#efe9dc', '#e3e0d6', '#f3ecd0', '#ece6d8'];
const f = (v: number): string => v.toFixed(1);

const ligne = (x1: number, y1: number, x2: number, y2: number, c: string, l = 1.4, extra = ''): string =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${c}" stroke-width="${l}"${extra}/>`;
const texte = (x: number, y: number, t: string, c = '#4a4842', taille = 11, ancre = 'start', extra = ''): string =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${taille}" fill="${c}" text-anchor="${ancre}"${extra}>${echapper(t)}</text>`;

function coupe(c: Calcul, y: (z: number) => number, cotes: boolean): string {
  const d = c.donnees;
  const bas = y(d.L) + 18;
  const zBas = d.L + 18 / ((y(1) - y(0)));
  let s = '';
  let t = 0;
  d.couches.forEach((k, i) => {
    const haut = t;
    const fin = i === d.couches.length - 1 ? zBas : Math.min(t + k.h, zBas);
    t += k.h;
    if (haut >= zBas) return;
    const fill = COULEURS_SOL[i % COULEURS_SOL.length];
    s += `<rect x="${GAUCHE}" y="${f(y(haut))}" width="${MUR - GAUCHE}" height="${f(y(fin) - y(haut))}" fill="${fill}" stroke="#c8c6c0"/>`;
    if (fin > d.H) {
      const h0 = Math.max(haut, d.H);
      s += `<rect x="${MUR}" y="${f(y(h0))}" width="${DROITE - MUR}" height="${f(y(fin) - y(h0))}" fill="${fill}" stroke="#c8c6c0"/>`;
    }
    s += texte(GAUCHE + 6, y(haut) + 15, k.nom, '#4a4842', 12);
    if (y(fin) - y(haut) > 30) {
      s += texte(GAUCHE + 6, y(haut) + 29, `φ = ${nombreAffiche(k.phi, 0)}° · c = ${nombreAffiche(k.c, 0)} kPa`, '#6a6862', 10.5);
    }
  });
  s += ligne(GAUCHE, y(0), MUR, y(0), '#1a1a1a', 1.5) + ligne(MUR, y(d.H), DROITE, y(d.H), '#1a1a1a', 1.5);

  let niveauCharge = 0;
  const trait = '#a8442a';
  for (const ch of d.charges) {
    if (ch.type === 'repartie' || ch.type === 'bande') {
      const echelleX = (MUR - GAUCHE) / 8;
      const x1 = ch.type === 'bande' ? Math.max(GAUCHE, MUR - (ch.a + ch.b) * echelleX) : GAUCHE + 10;
      const x2 = ch.type === 'bande' ? Math.max(GAUCHE, MUR - ch.a * echelleX) : MUR - 12;
      const y1 = HAUT - 18 - niveauCharge * 12;
      for (let x = x1; x <= x2 + 0.1; x += Math.max(8, (x2 - x1) / 8)) s += ligne(x, y1, x, HAUT - 3, trait, 1);
      s += ligne(x1, y1, x2, y1, trait);
      s += texte(x1, y1 - 3, `q = ${nombreAffiche(ch.q, 1)} kPa (${ch.nature})`, trait);
      niveauCharge += 1;
    }
    if (ch.type === 'force') {
      s += ligne(MUR - 42, y(ch.z), MUR - 6, y(ch.z), trait, 2) + `<polygon points="${MUR - 2},${f(y(ch.z))} ${MUR - 10},${f(y(ch.z) - 4)} ${MUR - 10},${f(y(ch.z) + 4)}" fill="${trait}"/>`;
      s += texte(MUR - 44, y(ch.z) - 4, `${nombreAffiche(ch.H, 1)} kN/m`, trait, 10.5);
    }
    if (ch.type === 'moment') s += texte(MUR - 44, y(ch.z) - 4, `M = ${nombreAffiche(ch.M, 1)} kN·m/m`, trait, 10.5);
    if (ch.type === 'pression') {
      const p = Math.max(Math.abs(ch.p1), Math.abs(ch.p2), 1);
      const lar = (v: number) => (24 * v) / p;
      s += `<polygon points="${MUR},${f(y(ch.z1))} ${f(MUR - lar(ch.p1))},${f(y(ch.z1))} ${f(MUR - lar(ch.p2))},${f(y(ch.z2))} ${MUR},${f(y(ch.z2))}" fill="${trait}" fill-opacity=".22" stroke="${trait}"/>`;
    }
  }

  const eau = '#3a7ca5';
  const pointille = ' stroke-dasharray="6 3"';
  if (d.eau.zTerre < zBas) {
    s += ligne(GAUCHE, y(d.eau.zTerre), MUR, y(d.eau.zTerre), eau, 1.4, pointille);
    s += texte(130, y(d.eau.zTerre) - 4, `nappe ${nombreAffiche(d.eau.zTerre, 2)} m`, eau, 10.5);
  }
  if (d.eau.zFouille < zBas) {
    s += ligne(MUR, y(d.eau.zFouille), DROITE, y(d.eau.zFouille), eau, 1.4, pointille);
    s += texte(280, y(d.eau.zFouille) + 12, `nappe ${nombreAffiche(d.eau.zFouille, 2)} m`, eau, 10.5);
  }

  s += `<rect x="${MUR - 4}" y="${f(y(0))}" width="8" height="${f(y(d.L) - y(0))}" fill="#e7eaee" stroke="#1a1a1a" stroke-width="1.4"/>`;
  for (const a of d.appuis) {
    const i = (a.inclinaison * Math.PI) / 180;
    const sens = a.type === 'tirant' ? -1 : 1;
    const l = 72;
    const bleu = '#2f5d8a';
    s += ligne(MUR, y(a.z), MUR + sens * l * Math.cos(i), y(a.z) + l * Math.sin(i), bleu, 2);
    s += `<circle cx="${MUR}" cy="${f(y(a.z))}" r="4" fill="${bleu}"/>`;
    s += texte(MUR + (a.type === 'tirant' ? 8 : -8), y(a.z) - 6, a.nom, bleu, 10.5, a.type === 'tirant' ? 'start' : 'end');
  }
  if (cotes) {
    s += texte(MUR + 8, y(d.H) - 5, `H = ${nombreAffiche(d.H, 2)} m`, '#1a1a1a');
    s += texte(MUR + 8, y(d.L) + 13, `L = ${nombreAffiche(d.L, 2)} m`, '#1a1a1a');
  }
  return s + `<!-- bas ${f(bas)} -->`;
}

interface Diagramme { titre: string; unite: string; z: number[]; v: number[]; couleur: string; decimales: number }

function diagramme(x0: number, g: Diagramme, y: (z: number) => number): string {
  const demi = COLONNE / 2 - 16;
  const m = Math.max(1e-9, ...g.v.map(Math.abs));
  const px = (v: number): number => x0 + (v / m) * demi;
  const points = g.z.map((z, i) => `${f(px(g.v[i]))},${f(y(z))}`);
  const zFin = g.z[g.z.length - 1];
  const poly = `${f(x0)},${f(y(g.z[0]))} ${points.join(' ')} ${f(x0)},${f(y(zFin))}`;
  let iMax = 0;
  let iMin = 0;
  g.v.forEach((v, i) => {
    if (v > g.v[iMax]) iMax = i;
    if (v < g.v[iMin]) iMin = i;
  });
  const etiquette = (i: number): string => {
    if (Math.abs(g.v[i]) < m * 0.02) return '';
    const droite = g.v[i] > 0;
    const yt = Math.min(y(g.z[i]) + 4, y(zFin) + 12);
    return texte(px(g.v[i]) + (droite ? -2 : 2), yt, nombreAffiche(g.v[i], g.decimales), g.couleur, 10.5, droite ? 'end' : 'start', ' stroke="#fff" stroke-width="3" paint-order="stroke"');
  };
  return texte(x0, 32, g.titre, '#4a4842', 12.5, 'middle', ' font-weight="600"') +
    texte(x0, 46, g.unite, '#6a6862', 10.5, 'middle') +
    ligne(x0, y(g.z[0]), x0, y(zFin), '#1a1a1a', 1) +
    `<polygon points="${poly}" fill="${g.couleur}" fill-opacity=".22" stroke="${g.couleur}" stroke-width="1.2"/>` +
    etiquette(iMax) + (iMin === iMax ? '' : etiquette(iMin));
}

export function coupeEtDiagrammes(c: Calcul, r: Resultat, o: OptionsDessin): string {
  const combi = r.combinaisons.find((x) => x.nom === o.combinaison) ?? r.combinaisons[0];
  const echelle = TRACE / c.donnees.L;
  const y = (z: number): number => HAUT + z * echelle;
  const k = combi.courbes;
  const toutes: (Diagramme & { actif: boolean })[] = [
    { actif: o.q, titre: 'Charge équivalente q', unite: 'kN/m', z: k.z, v: k.q, couleur: '#2f5d8a', decimales: 0 },
    { actif: o.V, titre: 'Effort tranchant V', unite: 'kN/m', z: k.z, v: k.V, couleur: '#1f6f3f', decimales: 0 },
    { actif: o.M, titre: 'Moment M', unite: 'kN·m/m', z: k.z, v: k.M, couleur: '#a8442a', decimales: 0 },
    { actif: o.w, titre: 'Déplacement w', unite: 'mm', z: r.service.z, v: r.service.w, couleur: '#8a6d00', decimales: 1 },
  ];
  const actifs = toutes.filter((t) => t.actif);
  const largeur = DROITE + 15 + COLONNE * actifs.length;
  const corps = coupe(c, y, o.cotes) +
    actifs.map((t, i) => diagramme(DROITE + 15 + COLONNE * (i + 0.5), t, y)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${HAUT + TRACE + 26}" role="img" font-family="system-ui, 'Segoe UI', Roboto, sans-serif" aria-label="Coupe de la paroi et diagrammes q, V, M et w">${corps}</svg>`;
}

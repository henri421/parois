/** Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui). PUR : aucun calcul. */

import { nombreAffiche, tauxAffiche, type ElementNote, type LigneResultat, type NoteDeCalcul, type VerificationNote } from 'aedificium-ui';
import { coupeEtDiagrammes } from './dessin';
import type { Calcul, Resultat } from './form';
import { aff, blocsResultat, clauseRotation, entreesParSection, HYPOTHESES, nomCombinaison } from './vue';

const bloc = (titre: string, lignes: LigneResultat[]): ElementNote => ({ type: 'bloc', bloc: { titre, lignes, note: null } });

const COMBINAISONS: Record<1 | 2, string[]> = {
  2: [
    'EN 1997-3:2025, tableau 7.2. Approche (a)+(b) : VC4 avec M1, effets majorés, puis VC3 avec M2 sur les propriétés du sol.',
    'Approche (d) : VC1, résistance de butée divisée par γ_Re.',
    'Situations durables et transitoires.',
  ],
  1: [
    'EN 1997-1:2004, annexe A. La butée est traitée comme une résistance en DA2 (γ_Re) et comme une action géotechnique en DA1 et DA3.',
    'Situations durables et transitoires.',
  ],
};

function tableaux(c: Calcul, r: Resultat): ElementNote[] {
  const pas = 0.5;
  const x = r.combinaisons.find((k) => k.nom === r.gouvernant.combinaison) ?? r.combinaisons[0];
  const lignes: string[][] = [];
  let suivant = 0;
  for (let i = 0; i < x.courbes.z.length; i += 1) {
    const z = x.courbes.z[i];
    if (z + 1e-6 < suivant) continue;
    lignes.push([aff(z, 2), aff(x.courbes.q[i], 1), aff(x.courbes.V[i], 1), aff(x.courbes.M[i], 1), aff(x.courbes.N[i], 1)]);
    suivant = Math.floor(z / pas + 1e-6) * pas + pas;
  }
  const synthese: ElementNote = {
    type: 'tableau',
    titre: 'Efforts et mobilisation, par combinaison',
    entetes: ['Combinaison', 'M_max (kN·m/m)', 'V_max (kN/m)', 'N_max (kN/m)', 'Butée mobilisée', 'Fiche min. (m)'],
    lignes: r.combinaisons.map((k) => [nomCombinaison(k.nom), aff(k.Mmax, 1), aff(k.Vmax, 1), aff(k.Nmax, 1), tauxAffiche(k.mobilisation), k.ficheMinimale === null ? '—' : aff(k.ficheMinimale, 2)]),
  };
  const appuis: ElementNote[] = c.donnees.appuis.length === 0 ? [] : [{
    type: 'tableau',
    titre: 'Appuis',
    entetes: ['Combinaison', 'Appui', 'z (m)', 'R_h (kN/m)', 'Effort axial (kN)', 'M lierne (kN·m)'],
    lignes: r.combinaisons.flatMap((k) => k.appuis.map((a) => [nomCombinaison(k.nom), a.nom, aff(a.z, 2), aff(a.Rh, 1), aff(a.axial, 1), aff(a.Mlierne, 1)])),
  }];
  return [synthese, ...appuis, {
    type: 'tableau',
    titre: `Valeurs le long de la paroi, ${nomCombinaison(x.nom)}`,
    entetes: ['z (m)', 'q (kN/m)', 'V (kN/m)', 'M (kN·m/m)', 'N (kN/m)'],
    lignes,
  }];
}

function descriptionCharge(c: Calcul['donnees']['charges'][number]): string[] {
  if (c.type === 'repartie') return ['Répartie', c.nature, `q = ${aff(c.q, 1)} kPa`];
  if (c.type === 'bande') return ['Bande', c.nature, `q = ${aff(c.q, 1)} kPa, à ${aff(c.a, 2)} m, largeur ${aff(c.b, 2)} m, paroi ${c.rigide ? 'rigide' : 'souple'}`];
  if (c.type === 'force') return ['Force', c.nature, `H = ${aff(c.H, 1)} kN/m à z = ${aff(c.z, 2)} m`];
  if (c.type === 'moment') return ['Moment', c.nature, `M = ${aff(c.M, 1)} kN·m/m à z = ${aff(c.z, 2)} m`];
  return ['Pression imposée', c.nature, `${aff(c.p1, 1)} à ${aff(c.p2, 1)} kPa, de z = ${aff(c.z1, 2)} à ${aff(c.z2, 2)} m`];
}

export function noteDuCalcul(calcul: Calcul, r: Resultat, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const d = calcul.donnees;
  const e = entreesParSection(calcul);
  const figure = coupeEtDiagrammes(calcul, r, { q: true, V: true, M: true, w: true, cotes: true, combinaison: r.gouvernant.combinaison });
  const verifications: VerificationNote[] = r.combinaisons.map((x) => ({
    nom: `Rotation, ${nomCombinaison(x.nom)}`,
    clause: clauseRotation(r),
    taux: x.mobilisation,
    ok: x.mobilisation <= 1,
  }));
  const nf = (v: number | null): string => (v === null ? 'auto' : nombreAffiche(v, 3));
  const norme = d.norme.generation === 2
    ? 'EN 1997-3:2025, EN 1990:2023'
    : d.norme.profil === 'anb' ? 'EN 1997-1:2004, NBN EN 1997-1 ANB:2022' : 'EN 1997-1:2004';
  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? 'Paroi' : cartouche.element,
      date: cartouche.date,
      norme,
      outil: 'parois',
    },
    sections: {
      geometrie: [
        bloc('Paroi', e.geometrie),
        { type: 'figure', svg: figure, legende: `Coupe et diagrammes q, V, M (${nomCombinaison(r.gouvernant.combinaison)}) ; w caractéristique, positif vers la fouille.` },
      ],
      materiaux: [{
        type: 'tableau',
        titre: 'Couches',
        entetes: ['Couche', 'h (m)', 'γ / γ_sat (kN/m³)', 'φ (°)', 'c (kPa)', 'kδ actif', 'kδ passif', 'K_a', 'K_p'],
        lignes: d.couches.map((c) => [c.nom, aff(c.h, 2), `${aff(c.gamma, 1)} / ${aff(c.gammaSat, 1)}`, aff(c.phi, 1), aff(c.c, 1), aff(c.kDeltaA, 3), aff(c.kDeltaP, 3), nf(c.KaImpose), nf(c.KpImpose)]),
      }],
      hypotheses: [bloc('Choix de calcul', e.hypotheses), { type: 'liste', items: HYPOTHESES }],
      charges: [
        bloc('Eau', e.eau),
        { type: 'tableau', titre: 'Charges', entetes: ['Type', 'Nature', 'Définition'], lignes: d.charges.map(descriptionCharge) },
        ...(d.appuis.length === 0 ? [] : [{
          type: 'tableau' as const,
          titre: 'Appuis, définition',
          entetes: ['Appui', 'Type', 'z (m)', 'Incl. (°)', 'Entraxe (m)', 'Raideur', 'Effort imposé (kN)'],
          lignes: d.appuis.map((a) => [a.nom, a.type, aff(a.z, 2), aff(a.inclinaison, 1), aff(a.entraxe, 2), a.EA === null ? 'rigide' : `EA ${aff(a.EA, 0)} kN, L ${aff(a.longueur ?? 0, 2)} m`, a.effortImpose === null ? '—' : aff(a.effortImpose, 1)]),
        }]),
      ],
      combinaisons: [
        { type: 'liste', items: COMBINAISONS[r.generation] },
        ...r.combinaisons.map((x) => bloc(`Coefficients, ${nomCombinaison(x.nom)}`, x.coefficients.map((k) => ({ symbole: k.nom, libelle: k.source, valeur: nombreAffiche(k.valeur, 3) })))),
      ],
      calculs: [...tableaux(calcul, r), ...blocsResultat(r).map((b): ElementNote => ({ type: 'bloc', bloc: b }))],
    },
    verifications,
    avertissements: r.alertes,
  };
}

/** Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui). PUR : aucun calcul. */

import { avertissement2eGeneration, nombreAffiche, tauxAffiche, type ElementNote, type LigneResultat, type NoteDeCalcul, type VerificationNote } from 'aedificium-ui';
import { verifierAcier, type ElementAcier } from '../../src/acier';
import { coupeEtDiagrammes } from './dessin';
import type { Calcul, Resultat } from './form';
import { phrase, T } from './textes';
import { aff, blocsResultat, clauseRotation, entreesParSection, hypotheses, nature, nomCombinaison, titreAcier } from './vue';
import { VERSION_OUTIL } from './version';

const bloc = (titre: string, lignes: LigneResultat[]): ElementNote => ({ type: 'bloc', bloc: { titre, lignes, note: null } });

const combinaisons = (g: 1 | 2): string[] => (g === 2
  ? [
    T('EN 1997-3:2025, tableau 7.2. Approche (a)+(b) : VC4 avec M1, effets majorés, puis VC3 avec M2 sur les propriétés du sol.',
      'EN 1997-3:2025, Table 7.2. Approach (a)+(b): VC4 with M1, factored effects, then VC3 with M2 on the ground properties.'),
    T('Approche (d) : VC1, résistance de butée divisée par γ_Re.', 'Approach (d): VC1, passive resistance divided by γ_Re.'),
    T('Situations durables et transitoires.', 'Persistent and transient situations.'),
  ]
  : [
    T('EN 1997-1:2004, annexe A. La butée est traitée comme une résistance en DA2 (γ_Re) et comme une action géotechnique en DA1 et DA3.',
      'EN 1997-1:2004, Annex A. Passive pressure is treated as a resistance in DA2 (γ_Re) and as a geotechnical action in DA1 and DA3.'),
    T('Situations durables et transitoires.', 'Persistent and transient situations.'),
  ]);

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
  const comb = T('Combinaison', 'Combination');
  const synthese: ElementNote = {
    type: 'tableau',
    titre: T('Efforts et mobilisation, par combinaison', 'Forces and mobilisation, per combination'),
    entetes: [comb, 'M_max (kN·m/m)', 'V_max (kN/m)', 'N_max (kN/m)', T('Butée mobilisée', 'Passive mobilised'), T('Fiche min. (m)', 'Min. embedment (m)')],
    lignes: r.combinaisons.map((k) => [nomCombinaison(k.nom), aff(k.Mmax, 1), aff(k.Vmax, 1), aff(k.Nmax, 1), tauxAffiche(k.mobilisation), k.ficheMinimale === null ? '—' : aff(k.ficheMinimale, 2)]),
  };
  const appuis: ElementNote[] = c.donnees.appuis.length === 0 ? [] : [{
    type: 'tableau',
    titre: T('Appuis', 'Supports'),
    entetes: [comb, T('Appui', 'Support'), 'z (m)', 'R_h (kN/m)', T('Effort axial (kN)', 'Axial force (kN)'), T('M lierne (kN·m)', 'M waler (kN·m)')],
    lignes: r.combinaisons.flatMap((k) => k.appuis.map((a) => [nomCombinaison(k.nom), a.nom, aff(a.z, 2), aff(a.Rh, 1), aff(a.axial, 1), aff(a.Mlierne, 1)])),
  }];
  return [synthese, ...appuis, {
    type: 'tableau',
    titre: `${T('Valeurs le long de la paroi', 'Values along the wall')}, ${nomCombinaison(x.nom)}`,
    entetes: ['z (m)', 'q (kN/m)', 'V (kN/m)', 'M (kN·m/m)', 'N (kN/m)'],
    lignes,
  }];
}

function descriptionCharge(c: Calcul['donnees']['charges'][number]): string[] {
  const n = nature(c.nature);
  if (c.type === 'repartie') return [T('Répartie', 'Uniform'), n, `q = ${aff(c.q, 1)} kPa`];
  if (c.type === 'bande') {
    const modele = c.modele === 'coin' ? T('coin de poussée', 'earth-pressure wedge')
      : c.rigide ? T('Boussinesq doublée', 'Boussinesq doubled') : 'Boussinesq';
    return [T('Bande', 'Strip'), n, T(`q = ${aff(c.q, 1)} kPa, à ${aff(c.a, 2)} m, largeur ${aff(c.b, 2)} m, ${modele}`,
      `q = ${aff(c.q, 1)} kPa, at ${aff(c.a, 2)} m, width ${aff(c.b, 2)} m, ${modele}`)];
  }
  if (c.type === 'force') return [T('Force', 'Force'), n, T(`H = ${aff(c.H, 1)} kN/m à z = ${aff(c.z, 2)} m`, `H = ${aff(c.H, 1)} kN/m at z = ${aff(c.z, 2)} m`)];
  if (c.type === 'moment') return ['Moment', n, T(`M = ${aff(c.M, 1)} kN·m/m à z = ${aff(c.z, 2)} m`, `M = ${aff(c.M, 1)} kN·m/m at z = ${aff(c.z, 2)} m`)];
  return [T('Pression imposée', 'Imposed pressure'), n, T(`${aff(c.p1, 1)} à ${aff(c.p2, 1)} kPa, de z = ${aff(c.z1, 2)} à ${aff(c.z2, 2)} m`,
    `${aff(c.p1, 1)} to ${aff(c.p2, 1)} kPa, from z = ${aff(c.z1, 2)} to ${aff(c.z2, 2)} m`)];
}

const tableauAcier = (elements: ElementAcier[]): ElementNote[] => (elements.length === 0 ? [] : [{
  type: 'tableau',
  titre: T('Acier', 'Steel'),
  entetes: [T('Élément', 'Element'), T('Profilé', 'Section'), 'N (kN)', 'M (kN·m)', 'V (kN)', 'L (m)', T('Taux', 'Ratio')],
  lignes: elements.map((e) => [titreAcier(e), `${e.profil} ${e.nuance}`, aff(e.N, 1), aff(e.M, 1), aff(e.V, 1), aff(e.longueur, 2),
    e.taux === null ? '—' : tauxAffiche(e.taux)]),
}]);

export function noteDuCalcul(calcul: Calcul, r: Resultat, cartouche: { projet: string; element: string; date: string }) {
  const d = calcul.donnees;
  const e = entreesParSection(calcul);
  const figure = coupeEtDiagrammes(calcul, r, { q: true, V: true, M: true, w: true, cotes: true, combinaison: r.gouvernant.combinaison });
  const acier = verifierAcier(calcul.donnees, r, calcul.acier);
  const verifications: (VerificationNote & { taux: number })[] = [
    ...r.combinaisons.map((x) => ({
      nom: `Rotation, ${nomCombinaison(x.nom)}`,
      clause: clauseRotation(r),
      taux: x.mobilisation,
      ok: x.mobilisation <= 1,
    })),
    ...acier.map((x) => ({
      nom: `${titreAcier(x)}, ${x.profil} ${x.nuance}`,
      clause: 'EN 1993-1-1, 6.2 ; 6.3',
      taux: x.taux ?? NaN,
      ok: x.taux !== null && x.taux <= 1,
    })),
  ];
  const nf = (v: number | null): string => (v === null ? 'auto' : nombreAffiche(v, 3));
  const norme = d.norme.generation === 2
    ? 'EN 1997-3:2025, EN 1990:2023'
    : d.norme.profil === 'anb' ? 'EN 1997-1:2004, NBN EN 1997-1 ANB:2022' : 'EN 1997-1:2004';
  const rigide = T('rigide', 'rigid');
  return {
    cartouche: {
      version: VERSION_OUTIL,
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? T('Paroi', 'Wall') : cartouche.element,
      date: cartouche.date,
      norme,
      outil: 'parois',
    },
    sections: {
      geometrie: [
        bloc(T('Paroi', 'Wall'), e.geometrie),
        {
          type: 'figure', svg: figure,
          legende: T(`Coupe et diagrammes q, V, M (${nomCombinaison(r.gouvernant.combinaison)}) ; w caractéristique, positif vers la fouille.`,
            `Section and q, V, M diagrams (${nomCombinaison(r.gouvernant.combinaison)}); characteristic w, positive towards the excavation.`),
        },
      ],
      materiaux: [{
        type: 'tableau',
        titre: T('Couches', 'Layers'),
        entetes: [T('Couche', 'Layer'), 'h (m)', 'γ / γ_sat (kN/m³)', 'φ (°)', 'c (kPa)', T('kδ actif', 'kδ active'), T('kδ passif', 'kδ passive'), 'K_a', 'K_p'],
        lignes: d.couches.map((c) => [c.nom, aff(c.h, 2), `${aff(c.gamma, 1)} / ${aff(c.gammaSat, 1)}`, aff(c.phi, 1), aff(c.c, 1), aff(c.kDeltaA, 3), aff(c.kDeltaP, 3), nf(c.KaImpose), nf(c.KpImpose)]),
      }],
      hypotheses: [bloc(T('Choix de calcul', 'Calculation choices'), e.hypotheses), { type: 'liste', items: hypotheses() }],
      charges: [
        bloc(T('Eau', 'Water'), e.eau),
        { type: 'tableau', titre: T('Charges', 'Loads'), entetes: ['Type', 'Nature', T('Définition', 'Definition')], lignes: d.charges.map(descriptionCharge) },
        ...(d.appuis.length === 0 ? [] : [{
          type: 'tableau' as const,
          titre: T('Appuis, définition', 'Supports, definition'),
          entetes: [T('Appui', 'Support'), 'Type', 'z (m)', T('Incl. (°)', 'Incl. (°)'), T('Entraxe (m)', 'Spacing (m)'), T('Raideur', 'Stiffness'), T('Effort imposé (kN)', 'Imposed force (kN)')],
          lignes: d.appuis.map((a) => [a.nom, a.type === 'tirant' ? T('tirant', 'anchor') : T('buton', 'strut'), aff(a.z, 2), aff(a.inclinaison, 1), aff(a.entraxe, 2),
            a.EA === null ? rigide : `EA ${aff(a.EA, 0)} kN, L ${aff(a.longueur ?? 0, 2)} m`, a.effortImpose === null ? '—' : aff(a.effortImpose, 1)]),
        }]),
      ],
      combinaisons: [
        { type: 'liste', items: combinaisons(r.generation) },
        ...r.combinaisons.map((x) => bloc(`${T('Coefficients', 'Factors')}, ${nomCombinaison(x.nom)}`,
          x.coefficients.map((k) => ({ symbole: k.nom, libelle: phrase(k.source), valeur: nombreAffiche(k.valeur, 3) })))),
      ],
      calculs: [...tableaux(calcul, r), ...tableauAcier(acier), ...blocsResultat(r).map((b): ElementNote => ({ type: 'bloc', bloc: b }))],
    },
    verifications,
    avertissements: [...(r.generation === 2 ? [avertissement2eGeneration()] : []), ...r.alertes.map(phrase)],
  } satisfies NoteDeCalcul;
}

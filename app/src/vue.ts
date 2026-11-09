/** Presentation : listes de saisie, cartes de verdict, volets, blocs de resultats. Mise en forme pure : aucun calcul. */

import { echapper, nombreAffiche, notationHtml, tauxAffiche, type BlocResultat, type LigneResultat } from 'aedificium-ui';
import type { Calcul, Resultat, Saisie } from './form';

type Combi = Resultat['combinaisons'][number];

export const aff = (v: number, d: number): string => (Number.isFinite(v) ? nombreAffiche(v, d) : 'non calculable');
const sym = (s: string): string => notationHtml(s);
const ligne = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

export const HYPOTHESES = [
  'Équilibre limite : poussée et butée pleinement développées (D.8) ; pour une fiche supérieure au minimum, la butée est réduite d’un même facteur pour rétablir l’équilibre.',
  'Paroi et appuis forment un portique plan résolu par éléments de poutre ; un appui sans EA est rigide.',
  'Pied libre : effort tranchant nul en pied. Pied encastré : moment nul au pied statique, la fiche réelle étant majorée de 20 % (méthode de Blum). Degré intermédiaire : interpolation linéaire entre les deux, choix de l’outil.',
  'K_a et K_p selon l’annexe D, D.3.2, couche par couche ; pression active minimale de 10 % de la contrainte verticale (7.5.3.2). K_0 = 1 − sin φ.',
  'Redistribution : terres et surcharges réparties sur la hauteur retenue, résultante conservée. L’eau, les bandes et les pressions imposées ne sont pas redistribuées.',
  'Charge en bande : Boussinesq en demi-espace, doublée pour une paroi rigide (Terzaghi).',
  'Eau : hydrostatique, ou gradient uniforme i = Δh / longueur du chemin autour du pied.',
  'Lierne : T·a²/10 si continue, T·a²/8 sur deux appuis, choix de l’outil.',
  'Déplacement w : ligne élastique EI·w″ = M sous charges caractéristiques. Indicatif : ni phasage ni rigidité du sol (D.8).',
];

export function nomCombinaison(nom: string): string {
  if (nom === '(a)') return '(a) VC4 + M1, effets × γ_E';
  if (nom === '(b)') return '(b) VC3 + M2';
  if (nom === '(d)') return '(d) VC1, résistance γ_Re';
  return nom;
}

const clauses = (g: 1 | 2) => (g === 2
  ? { rotation: 'EN 1997-3:2025, 7.6.3 et D.8', paroi: '7.6.8', appui: '7.6.7', service: '7.7 et D.8', eau: '7.6.6' }
  : { rotation: 'EN 1997-1:2004, 9.7.4', paroi: '9.7.6', appui: '9.7.7', service: '9.8', eau: '2.4.7.5' });

export const clauseRotation = (r: Resultat): string => clauses(r.generation).rotation;

// -------------------------------------------------------------------------------------------------
// Listes de saisie
// -------------------------------------------------------------------------------------------------

const champ = (libelle: string, liste: string, i: number, sous: string, valeur: string, indice = ''): string =>
  `<label class="ligne"><span>${libelle}</span><input type="text" inputmode="decimal" data-liste="${liste}" data-i="${i}" data-sous="${sous}" value="${echapper(valeur)}" placeholder="${indice}"></label>`;

const choix = (libelle: string, liste: string, i: number, sous: string, valeur: string, options: [string, string][]): string =>
  `<label class="ligne"><span>${libelle}</span><select data-liste="${liste}" data-i="${i}" data-sous="${sous}">${options.map(([v, t]) =>
    `<option value="${v}"${v === valeur ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;

const titreItem = (liste: string, i: number, nom: string): string =>
  `<div class="item-tete"><input type="text" class="nom" aria-label="Nom" data-liste="${liste}" data-i="${i}" data-sous="nom" value="${echapper(nom)}"><button type="button" data-action="retirer" data-liste="${liste}" data-i="${i}" aria-label="Retirer">−</button></div>`;

export const couchesHtml = (s: Saisie): string => s.couches.map((c, i) =>
  `<div class="item">${titreItem('couches', i, c.nom)}` +
  champ('Épaisseur (m)', 'couches', i, 'h', c.h) +
  champ('γ (kN/m³)', 'couches', i, 'gamma', c.gamma) +
  champ(`${sym('γ_sat')} (kN/m³)`, 'couches', i, 'gammaSat', c.gammaSat) +
  champ('φ′ (°), 0 si non drainé', 'couches', i, 'phi', c.phi) +
  champ(`c′ ou ${sym('c_u')} (kPa)`, 'couches', i, 'c', c.c) +
  champ(`${sym('k_tan δ')} actif`, 'couches', i, 'kDeltaA', c.kDeltaA) +
  champ(`${sym('k_tan δ')} passif`, 'couches', i, 'kDeltaP', c.kDeltaP) +
  champ(`${sym('K_a')} imposé (horizontal)`, 'couches', i, 'Ka', c.Ka, 'auto') +
  champ(`${sym('K_p')} imposé (horizontal)`, 'couches', i, 'Kp', c.Kp, 'auto') +
  '</div>').join('');

export const appuisHtml = (s: Saisie): string => (s.appuis.length === 0
  ? '<p class="source">Aucun appui : console, pied encastré à 100 %.</p>'
  : s.appuis.map((a, i) =>
    `<div class="item">${titreItem('appuis', i, a.nom)}` +
    choix('Type', 'appuis', i, 'type', a.type, [['tirant', 'Tirant'], ['buton', 'Buton ou dalle']]) +
    champ('Niveau sous la tête (m)', 'appuis', i, 'z', a.z) +
    champ('Inclinaison (°)', 'appuis', i, 'inclinaison', a.inclinaison) +
    champ('Entraxe (m)', 'appuis', i, 'entraxe', a.entraxe) +
    champ('Effort imposé (kN)', 'appuis', i, 'effort', a.effort, 'aucun') +
    champ('EA de l’appui (kN)', 'appuis', i, 'EA', a.EA, 'rigide') +
    champ('Longueur libre (m)', 'appuis', i, 'longueur', a.longueur, 'rigide') +
    choix('Lierne', 'appuis', i, 'lierne', a.lierne, [['continue', 'Continue : T·a²/10'], ['deux-appuis', 'Sur deux appuis : T·a²/8'], ['aucune', 'Aucune']]) +
    '</div>').join(''));

const TYPES_CHARGE: [string, string][] = [
  ['repartie', 'Répartie infinie'], ['bande', 'Bande parallèle à la paroi'], ['force', 'Force horizontale'],
  ['moment', 'Moment'], ['pression', 'Pression imposée sur la paroi'],
];

export const chargesHtml = (s: Saisie): string => (s.charges.length === 0
  ? '<p class="source">Aucune charge.</p>'
  : s.charges.map((c, i) => {
    let corps = '';
    if (c.type === 'repartie') corps = champ('q (kPa)', 'charges', i, 'q', c.q);
    if (c.type === 'bande') {
      corps = champ('q (kPa)', 'charges', i, 'q', c.q) +
        champ('Distance à la paroi (m)', 'charges', i, 'a', c.a) +
        champ('Largeur (m)', 'charges', i, 'b', c.b) +
        `<label class="coche"><input type="checkbox" data-liste="charges" data-i="${i}" data-sous="rigide"${c.rigide ? ' checked' : ''}> Paroi rigide : Boussinesq doublée</label>`;
    }
    if (c.type === 'force') corps = champ('H vers la fouille (kN/m)', 'charges', i, 'H', c.H) + champ('Niveau (m)', 'charges', i, 'z', c.z);
    if (c.type === 'moment') corps = champ('M (kN·m/m)', 'charges', i, 'M', c.M) + champ('Niveau (m)', 'charges', i, 'z', c.z);
    if (c.type === 'pression') {
      corps = champ(`${sym('z_1')} (m)`, 'charges', i, 'z1', c.z1) + champ(`${sym('z_2')} (m)`, 'charges', i, 'z2', c.z2) +
        champ(`${sym('p_1')} (kPa)`, 'charges', i, 'p1', c.p1) + champ(`${sym('p_2')} (kPa)`, 'charges', i, 'p2', c.p2);
    }
    return `<div class="item"><div class="item-tete"><b>Charge ${i + 1}</b><button type="button" data-action="retirer" data-liste="charges" data-i="${i}" aria-label="Retirer">−</button></div>` +
      choix('Type', 'charges', i, 'type', c.type, TYPES_CHARGE) +
      choix('Nature', 'charges', i, 'nature', c.nature, [['variable', 'Variable'], ['permanente', 'Permanente']]) +
      corps + '</div>';
  }).join(''));

// -------------------------------------------------------------------------------------------------
// Verdicts
// -------------------------------------------------------------------------------------------------

function carteTaux(titre: string, clause: string, taux: number, corps: string, gouvernant: boolean): string {
  const classe = Number.isFinite(taux) && taux <= 1 ? 'ok' : 'refus';
  const largeur = Number.isFinite(taux) ? Math.min(100, Math.max(0, taux * 100)) : 100;
  return `<div class="verdict ${classe}" data-verification="rotation"><h3><span>${sym(titre)}${gouvernant ? ' · gouvernant' : ''}</span> <span class="clause">${clause}</span></h3>` +
    `<div class="jauge"><i style="width:${largeur.toFixed(1)}%"></i></div><span class="taux">${tauxAffiche(taux)}</span><p>${corps}</p></div>`;
}

const constat = (titre: string, clause: string, corps: string): string =>
  `<div class="verdict constat"><h3><span>${sym(titre)}</span> <span class="clause">${clause}</span></h3><p>${corps}</p></div>`;

const texteFiche = (c: Calcul, x: Combi): string => {
  const reelle = c.donnees.L - c.donnees.H;
  const m = x.ficheMinimale === null ? 'aucune longueur n’équilibre la paroi' : `minimum ${aff(x.ficheMinimale, 2)} m`;
  return `Part de butée mobilisée. Fiche réelle ${aff(reelle, 2)} m ; ${m}.`;
};

export function verdictsHtml(c: Calcul, r: Resultat): string {
  const cl = clauses(r.generation);
  let h = '<div class="groupe">Résistance du terrain</div>';
  for (const x of r.combinaisons) {
    h += carteTaux(`Rotation · ${nomCombinaison(x.nom)}`, cl.rotation, x.mobilisation, texteFiche(c, x), x.nom === r.gouvernant.combinaison);
  }
  h += '<div class="groupe">Efforts à reprendre</div>';
  h += constat('Paroi', cl.paroi, `${sym('M_d')} = ${aff(r.Md, 1)} kN·m/m ; ${sym('V_d')} = ${aff(r.Vd, 1)} kN/m. À vérifier selon EN 1992 ou EN 1993-5.`);
  const enveloppe = c.donnees.appuis.map((a, i) => {
    const max = (f: (y: Combi['appuis'][number]) => number): number => Math.max(...r.combinaisons.map((x) => Math.abs(f(x.appuis[i]))));
    return { a, Rh: max((y) => y.Rh), T: max((y) => y.axial), L: max((y) => y.Mlierne) };
  });
  for (const e of enveloppe) {
    const lierne = e.L > 0 ? ` Lierne : ${sym('M_d')} = ${aff(e.L, 1)} kN·m.` : '';
    const impose = e.a.effortImpose === null ? '' : ' Effort imposé.';
    h += constat(`Appui ${e.a.nom}`, cl.appui, `${sym('R_h')} = ${aff(e.Rh, 1)} kN/m ; effort axial ${aff(e.T, 1)} kN par appui à ${aff(e.a.entraxe, 2)} m d’entraxe.${impose}${lierne}`);
  }
  const s = r.service;
  h += '<div class="groupe">Service</div>';
  h += constat('Déplacement', cl.service, `${sym('w_max')} = ${aff(s.wMax, 1)} mm à ${aff(s.zWMax, 2)} m ; en tête ${aff(s.wTete, 1)} mm. Valeur indicative, non comparée à une limite.`);
  if (r.gradient > 0) {
    h += '<div class="groupe">Eau</div>';
    h += constat('Gradient ascendant', cl.eau, `i = ${aff(r.gradient, 3)}. Le renard hydraulique et le soulèvement du fond restent à vérifier par ailleurs.`);
  }
  if (r.alertes.length > 0) {
    h += `<div class="alertes"><h3>Alertes</h3><ul>${r.alertes.map((a) => `<li>${sym(a)}</li>`).join('')}</ul></div>`;
  }
  return h;
}

export function voletsHtml(r: Resultat): string {
  const lignes = r.combinaisons.map((x) => {
    const appuis = x.appuis.map((a) => `${echapper(a.nom)} : ${aff(a.Rh, 1)}`).join(' · ') || '—';
    return `<tr${x.nom === r.gouvernant.combinaison ? ' class="gouverne"' : ''}><td>${sym(nomCombinaison(x.nom))}</td><td class="n">${aff(x.Mmax, 1)}</td><td class="n">${aff(x.Vmax, 1)}</td><td class="n">${aff(x.Nmax, 1)}</td><td class="n">${appuis}</td><td class="n">${tauxAffiche(x.mobilisation)}</td></tr>`;
  }).join('');
  const coef = r.combinaisons.map((x) => `<p><b>${sym(nomCombinaison(x.nom))}</b></p><ul>${x.coefficients.map((k) => `<li>${sym(k.nom)} = ${aff(k.valeur, 3)} : ${sym(k.source)}</li>`).join('')}</ul>`).join('');
  return `<details class="deriv" open><summary>Efforts par mètre de paroi</summary><div class="defile"><table><thead><tr><th>Combinaison</th><th class="n">${sym('M_max')} (kN·m)</th><th class="n">${sym('V_max')} (kN)</th><th class="n">${sym('N_max')} (kN)</th><th class="n">${sym('R_h')} (kN)</th><th class="n">butée mobilisée</th></tr></thead><tbody>${lignes}</tbody></table></div></details>` +
    `<details class="deriv"><summary>Coefficients et sources</summary><div>${coef}</div></details>` +
    `<details class="deriv"><summary>Hypothèses</summary><div><ul>${HYPOTHESES.map((t) => `<li>${sym(t)}</li>`).join('')}</ul></div></details>`;
}

// -------------------------------------------------------------------------------------------------
// Entrees et resultats en lignes, pour la note et le CSV
// -------------------------------------------------------------------------------------------------

export function entreesParSection(c: Calcul): Record<'geometrie' | 'hypotheses' | 'eau', LigneResultat[]> {
  const d = c.donnees;
  return {
    geometrie: [
      ligne('H', 'Hauteur retenue', `${aff(d.H, 2)} m`),
      ligne('L', 'Longueur de la paroi', `${aff(d.L, 2)} m`),
      ligne('EI', 'Rigidité en flexion', `${aff(d.EI, 0)} kN·m²/m`),
      ligne('EA', 'Rigidité axiale', `${aff(d.EA, 0)} kN/m`),
    ],
    hypotheses: [
      ligne('g', 'Degré d’encastrement du pied', `${aff(d.degreEncastrement * 100, 0)} %`),
      ligne('m', 'Part de K_0 côté terre', aff(d.partK0, 2)),
      ligne('forme', 'Redistribution', d.redistribution.forme),
    ],
    eau: [
      ligne('z_w,a', 'Nappe côté terre', `${aff(d.eau.zTerre, 2)} m`),
      ligne('z_w,p', 'Nappe côté fouille', `${aff(d.eau.zFouille, 2)} m`),
      ligne('', 'Écoulement autour du pied', d.eau.ecoulement ? 'oui' : 'non'),
    ],
  };
}

export const blocEntrees = (c: Calcul): LigneResultat[] => {
  const e = entreesParSection(c);
  return [...e.geometrie, ...e.hypotheses, ...e.eau];
};

export function blocsResultat(r: Resultat): BlocResultat[] {
  return [
    {
      titre: 'Synthèse',
      note: null,
      lignes: [
        ligne('combinaison', 'Combinaison gouvernante', nomCombinaison(r.gouvernant.combinaison)),
        ligne('taux', 'Part de butée mobilisée', tauxAffiche(r.gouvernant.mobilisation)),
        ligne('M_d', 'Moment de calcul, enveloppe', `${aff(r.Md, 1)} kN·m/m`),
        ligne('V_d', 'Effort tranchant de calcul, enveloppe', `${aff(r.Vd, 1)} kN/m`),
        ligne('w_max', 'Déplacement maximal, indicatif', `${aff(r.service.wMax, 1)} mm`),
      ],
    },
    ...r.combinaisons.map((x): BlocResultat => ({
      titre: nomCombinaison(x.nom),
      note: null,
      lignes: [
        ligne('taux', 'Part de butée mobilisée', tauxAffiche(x.mobilisation)),
        ligne('d_min', 'Fiche minimale', x.ficheMinimale === null ? 'aucune' : `${aff(x.ficheMinimale, 2)} m`),
        ligne('M_max', 'Moment maximal', `${aff(x.Mmax, 1)} kN·m/m`),
        ligne('V_max', 'Effort tranchant maximal', `${aff(x.Vmax, 1)} kN/m`),
        ligne('N_max', 'Effort normal maximal', `${aff(x.Nmax, 1)} kN/m`),
        ...x.appuis.flatMap((a) => [
          ligne(`R_h,${a.nom}`, `Réaction horizontale ${a.nom}`, `${aff(a.Rh, 1)} kN/m`),
          ligne(`T_${a.nom}`, `Effort axial par appui ${a.nom}`, `${aff(a.axial, 1)} kN`),
        ]),
      ],
    })),
  ];
}

export const messageDErreur = (e: unknown): string => (e instanceof Error ? e.message : String(e));

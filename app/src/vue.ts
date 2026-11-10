/** Presentation : listes de saisie, cartes de verdict, volets, blocs de resultats. Mise en forme pure : aucun calcul. */

import { echapper, nombreAffiche, notationHtml, tauxAffiche, type BlocResultat, type LigneResultat } from 'aedificium-ui';
import { modeleBande, type Calcul, type Resultat, type Saisie } from './form';
import { phrase, T } from './textes';

type Combi = Resultat['combinaisons'][number];

export const aff = (v: number, d: number): string => (Number.isFinite(v) ? nombreAffiche(v, d) : T('non calculable', 'not computable'));
const sym = (s: string): string => notationHtml(s);
/** Phrase du noyau, traduite au besoin, mise en forme. */
const txt = (s: string): string => notationHtml(phrase(s));
const ligne = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

export const hypotheses = (): string[] => [
  T('Équilibre limite : poussée et butée pleinement développées (D.8) ; pour une fiche supérieure au minimum, la butée est réduite d’un même facteur pour rétablir l’équilibre.',
    'Limit equilibrium: active and passive pressures fully mobilised (D.8); for an embedment above the minimum, the passive resistance is reduced by a single factor to restore equilibrium.'),
  T('Paroi et appuis forment un portique plan résolu par éléments de poutre ; un appui sans EA est rigide.',
    'Wall and supports form a plane frame solved with beam elements; a support without EA is rigid.'),
  T('Pied libre : effort tranchant nul en pied. Pied encastré : moment nul au pied statique, la fiche réelle étant majorée de 20 % (méthode de Blum). Degré intermédiaire : interpolation linéaire entre les deux, choix de l’outil.',
    'Free toe: zero shear at the toe. Fixed toe: zero moment at the static toe, the actual embedment being increased by 20 % (Blum’s method). Intermediate degree: linear interpolation between both, a choice of the tool.'),
  T('K_a et K_p selon l’annexe D, D.3.2, couche par couche ; pression active minimale de 10 % de la contrainte verticale (7.5.3.2). K_0 = 1 − sin φ.',
    'K_a and K_p to Annex D, D.3.2, layer by layer; minimum active pressure of 10 % of the vertical stress (7.5.3.2). K_0 = 1 − sin φ.'),
  T('Redistribution : terres et surcharges réparties sur la hauteur retenue, résultante conservée. L’eau, les bandes et les pressions imposées ne sont pas redistribuées.',
    'Redistribution: earth and uniform surcharges over the retained height, resultant preserved. Water, strip loads and imposed pressures are not redistributed.'),
  T('Charge en bande : Boussinesq en demi-espace, doublée pour une paroi rigide (Terzaghi) ; ou coin de poussée, résultante K_ah·q·b répartie uniformément entre a·tan φ et (a + b)·tan ϑ_a, ϑ_a plan de glissement de Coulomb, φ et δ de la couche de surface (répartition classique, choix de l’outil).',
    'Strip load: Boussinesq in a half-space, doubled for a rigid wall (Terzaghi); or earth-pressure wedge, resultant K_ah·q·b spread uniformly between a·tan φ and (a + b)·tan ϑ_a, ϑ_a Coulomb slip plane, φ and δ of the surface layer (classical distribution, a choice of the tool).'),
  T('Eau : hydrostatique, ou gradient uniforme i = Δh / longueur du chemin autour du pied.',
    'Water: hydrostatic, or uniform gradient i = Δh / length of the flow path around the toe.'),
  T('Lierne : T·a²/10 si continue, T·a²/8 sur deux appuis, choix de l’outil.',
    'Waler: T·a²/10 if continuous, T·a²/8 simply supported, a choice of the tool.'),
  T('Déplacement w : ligne élastique EI·w″ = M sous charges caractéristiques. Indicatif : ni phasage ni rigidité du sol (D.8).',
    'Displacement w: elastic line EI·w″ = M under characteristic loads. Indicative: neither staging nor ground stiffness (D.8).'),
];

export function nomCombinaison(nom: string): string {
  if (nom === '(a)') return T('(a) VC4 + M1, effets × γ_E', '(a) VC4 + M1, effects × γ_E');
  if (nom === '(b)') return '(b) VC3 + M2';
  if (nom === '(d)') return T('(d) VC1, résistance γ_Re', '(d) VC1, resistance γ_Re');
  return nom;
}

const clauses = (g: 1 | 2) => (g === 2
  ? { rotation: T('EN 1997-3:2025, 7.6.3 et D.8', 'EN 1997-3:2025, 7.6.3 and D.8'), paroi: '7.6.8', appui: '7.6.7', service: T('7.7 et D.8', '7.7 and D.8'), eau: '7.6.6' }
  : { rotation: 'EN 1997-1:2004, 9.7.4', paroi: '9.7.6', appui: '9.7.7', service: '9.8', eau: '2.4.7.5' });

export const clauseRotation = (r: Resultat): string => clauses(r.generation).rotation;

/** Nature d'une charge, affichee. */
export const nature = (n: string): string => (n === 'permanente' ? T('permanente', 'permanent') : 'variable');

// -------------------------------------------------------------------------------------------------
// Listes de saisie
// -------------------------------------------------------------------------------------------------

const champ = (libelle: string, liste: string, i: number, sous: string, valeur: string, indice = ''): string =>
  `<label class="ligne"><span>${libelle}</span><input type="text" inputmode="decimal" data-liste="${liste}" data-i="${i}" data-sous="${sous}" value="${echapper(valeur)}" placeholder="${indice}"></label>`;

const choix = (libelle: string, liste: string, i: number, sous: string, valeur: string, options: [string, string][]): string =>
  `<label class="ligne"><span>${libelle}</span><select data-liste="${liste}" data-i="${i}" data-sous="${sous}">${options.map(([v, t]) =>
    `<option value="${v}"${v === valeur ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;

const retirer = (liste: string, i: number): string =>
  `<button type="button" data-action="retirer" data-liste="${liste}" data-i="${i}" aria-label="${T('Retirer', 'Remove')}">−</button>`;

const titreItem = (liste: string, i: number, nom: string): string =>
  `<div class="item-tete"><input type="text" class="nom" aria-label="${T('Nom', 'Name')}" data-liste="${liste}" data-i="${i}" data-sous="nom" value="${echapper(nom)}">${retirer(liste, i)}</div>`;

export const couchesHtml = (s: Saisie): string => s.couches.map((c, i) =>
  `<div class="item">${titreItem('couches', i, c.nom)}` +
  champ(T('Épaisseur (m)', 'Thickness (m)'), 'couches', i, 'h', c.h) +
  champ('γ (kN/m³)', 'couches', i, 'gamma', c.gamma) +
  champ(`${sym('γ_sat')} (kN/m³)`, 'couches', i, 'gammaSat', c.gammaSat) +
  champ(T('φ′ (°), 0 si non drainé', 'φ′ (°), 0 if undrained'), 'couches', i, 'phi', c.phi) +
  champ(`${T('c′ ou', 'c′ or')} ${sym('c_u')} (kPa)`, 'couches', i, 'c', c.c) +
  champ(`${sym('k_tan δ')} ${T('actif', 'active')}`, 'couches', i, 'kDeltaA', c.kDeltaA) +
  champ(`${sym('k_tan δ')} ${T('passif', 'passive')}`, 'couches', i, 'kDeltaP', c.kDeltaP) +
  champ(`${sym('K_a')} ${T('imposé (horizontal)', 'imposed (horizontal)')}`, 'couches', i, 'Ka', c.Ka, 'auto') +
  champ(`${sym('K_p')} ${T('imposé (horizontal)', 'imposed (horizontal)')}`, 'couches', i, 'Kp', c.Kp, 'auto') +
  '</div>').join('');

export const appuisHtml = (s: Saisie): string => (s.appuis.length === 0
  ? `<p class="source">${T('Aucun appui : console, pied encastré à 100 %.', 'No support: cantilever, toe 100 % fixed.')}</p>`
  : s.appuis.map((a, i) =>
    `<div class="item">${titreItem('appuis', i, a.nom)}` +
    choix('Type', 'appuis', i, 'type', a.type, [['tirant', T('Tirant', 'Anchor')], ['buton', T('Buton ou dalle', 'Strut or slab')]]) +
    champ(T('Niveau sous la tête (m)', 'Level below the head (m)'), 'appuis', i, 'z', a.z) +
    champ(T('Inclinaison (°)', 'Inclination (°)'), 'appuis', i, 'inclinaison', a.inclinaison) +
    champ(T('Entraxe (m)', 'Spacing (m)'), 'appuis', i, 'entraxe', a.entraxe) +
    champ(T('Effort imposé (kN)', 'Imposed force (kN)'), 'appuis', i, 'effort', a.effort, T('aucun', 'none')) +
    champ(T('EA de l’appui (kN)', 'EA of the support (kN)'), 'appuis', i, 'EA', a.EA, T('rigide', 'rigid')) +
    champ(T('Longueur libre (m)', 'Free length (m)'), 'appuis', i, 'longueur', a.longueur, T('rigide', 'rigid')) +
    choix(T('Lierne', 'Waler'), 'appuis', i, 'lierne', a.lierne, [
      ['continue', T('Continue : T·a²/10', 'Continuous: T·a²/10')],
      ['deux-appuis', T('Sur deux appuis : T·a²/8', 'Simply supported: T·a²/8')],
      ['aucune', T('Aucune', 'None')],
    ]) +
    '</div>').join(''));

export const chargesHtml = (s: Saisie): string => {
  if (s.charges.length === 0) return `<p class="source">${T('Aucune charge.', 'No load.')}</p>`;
  const types: [string, string][] = [
    ['repartie', T('Répartie infinie', 'Uniform, infinite')], ['bande', T('Bande parallèle à la paroi', 'Strip parallel to the wall')],
    ['force', T('Force horizontale', 'Horizontal force')], ['moment', 'Moment'],
    ['pression', T('Pression imposée sur la paroi', 'Pressure imposed on the wall')],
  ];
  const niveau = T('Niveau (m)', 'Level (m)');
  return s.charges.map((c, i) => {
    let corps = '';
    if (c.type === 'repartie') corps = champ('q (kPa)', 'charges', i, 'q', c.q);
    if (c.type === 'bande') {
      corps = champ('q (kPa)', 'charges', i, 'q', c.q) +
        champ(T('Distance à la paroi (m)', 'Distance to the wall (m)'), 'charges', i, 'a', c.a) +
        champ(T('Largeur (m)', 'Width (m)'), 'charges', i, 'b', c.b) +
        choix(T('Modèle', 'Model'), 'charges', i, 'modele', modeleBande(c), [
          ['rigide', T('Boussinesq doublée (paroi rigide)', 'Boussinesq doubled (rigid wall)')],
          ['souple', T('Boussinesq (paroi souple)', 'Boussinesq (flexible wall)')],
          ['coin', T('Coin de poussée Kₐₕ·q·b', 'Earth-pressure wedge Kₐₕ·q·b')],
        ]);
    }
    if (c.type === 'force') corps = champ(T('H vers la fouille (kN/m)', 'H towards the excavation (kN/m)'), 'charges', i, 'H', c.H) + champ(niveau, 'charges', i, 'z', c.z);
    if (c.type === 'moment') corps = champ('M (kN·m/m)', 'charges', i, 'M', c.M) + champ(niveau, 'charges', i, 'z', c.z);
    if (c.type === 'pression') {
      corps = champ(`${sym('z_1')} (m)`, 'charges', i, 'z1', c.z1) + champ(`${sym('z_2')} (m)`, 'charges', i, 'z2', c.z2) +
        champ(`${sym('p_1')} (kPa)`, 'charges', i, 'p1', c.p1) + champ(`${sym('p_2')} (kPa)`, 'charges', i, 'p2', c.p2);
    }
    return `<div class="item"><div class="item-tete"><b>${T('Charge', 'Load')} ${i + 1}</b>${retirer('charges', i)}</div>` +
      choix('Type', 'charges', i, 'type', c.type, types) +
      choix('Nature', 'charges', i, 'nature', c.nature, [['variable', 'Variable'], ['permanente', T('Permanente', 'Permanent')]]) +
      corps + '</div>';
  }).join('');
};

// -------------------------------------------------------------------------------------------------
// Verdicts
// -------------------------------------------------------------------------------------------------

function carteTaux(titre: string, clause: string, taux: number, corps: string, gouvernant: boolean): string {
  const classe = Number.isFinite(taux) && taux <= 1 ? 'ok' : 'refus';
  const largeur = Number.isFinite(taux) ? Math.min(100, Math.max(0, taux * 100)) : 100;
  return `<div class="verdict ${classe}" data-verification="rotation"><h3><span>${sym(titre)}${gouvernant ? ` · ${T('gouvernant', 'governing')}` : ''}</span> <span class="clause">${clause}</span></h3>` +
    `<div class="jauge"><i style="width:${largeur.toFixed(1)}%"></i></div><span class="taux">${tauxAffiche(taux)}</span><p>${corps}</p></div>`;
}

const constat = (titre: string, clause: string, corps: string): string =>
  `<div class="verdict constat"><h3><span>${sym(titre)}</span> <span class="clause">${clause}</span></h3><p>${corps}</p></div>`;

const texteFiche = (c: Calcul, x: Combi): string => {
  const reelle = aff(c.donnees.L - c.donnees.H, 2);
  if (x.ficheMinimale === null) {
    return T(`Part de butée mobilisée. Fiche réelle ${reelle} m ; aucune longueur n’équilibre la paroi.`,
      `Share of passive resistance mobilised. Actual embedment ${reelle} m; no length balances the wall.`);
  }
  const m = aff(x.ficheMinimale, 2);
  return T(`Part de butée mobilisée. Fiche réelle ${reelle} m ; minimum ${m} m.`,
    `Share of passive resistance mobilised. Actual embedment ${reelle} m; minimum ${m} m.`);
};

export function verdictsHtml(c: Calcul, r: Resultat): string {
  const cl = clauses(r.generation);
  let h = `<div class="groupe">${T('Résistance du terrain', 'Ground resistance')}</div>`;
  for (const x of r.combinaisons) {
    h += carteTaux(`Rotation · ${nomCombinaison(x.nom)}`, cl.rotation, x.mobilisation, texteFiche(c, x), x.nom === r.gouvernant.combinaison);
  }
  h += `<div class="groupe">${T('Efforts à reprendre', 'Forces to be resisted')}</div>`;
  h += constat(T('Paroi', 'Wall'), cl.paroi, `${sym('M_d')} = ${aff(r.Md, 1)} kN·m/m ; ${sym('V_d')} = ${aff(r.Vd, 1)} kN/m. ${T('À vérifier selon EN 1992 ou EN 1993-5.', 'To be checked to EN 1992 or EN 1993-5.')}`
    .replace(' ; ', T(' ; ', '; ')));
  c.donnees.appuis.forEach((a, i) => {
    const max = (f: (y: Combi['appuis'][number]) => number): number => Math.max(...r.combinaisons.map((x) => Math.abs(f(x.appuis[i]))));
    const Rh = aff(max((y) => y.Rh), 1);
    const T_ = aff(max((y) => y.axial), 1);
    const Lm = max((y) => y.Mlierne);
    const e = aff(a.entraxe, 2);
    const lierne = Lm > 0 ? ` ${T('Lierne', 'Waler')} : ${sym('M_d')} = ${aff(Lm, 1)} kN·m.` : '';
    const impose = a.effortImpose === null ? '' : ` ${T('Effort imposé.', 'Imposed force.')}`;
    const corps = T(`${sym('R_h')} = ${Rh} kN/m ; effort axial ${T_} kN par appui à ${e} m d’entraxe.`,
      `${sym('R_h')} = ${Rh} kN/m; axial force ${T_} kN per support at ${e} m spacing.`) + impose + lierne;
    h += constat(`${T('Appui', 'Support')} ${a.nom}`, cl.appui, T(corps, corps.replace(' :', ':')));
  });
  const s = r.service;
  h += `<div class="groupe">Service</div>`;
  h += constat(T('Déplacement', 'Displacement'), cl.service, T(
    `${sym('w_max')} = ${aff(s.wMax, 1)} mm à ${aff(s.zWMax, 2)} m ; en tête ${aff(s.wTete, 1)} mm. Valeur indicative, non comparée à une limite.`,
    `${sym('w_max')} = ${aff(s.wMax, 1)} mm at ${aff(s.zWMax, 2)} m; at the head ${aff(s.wTete, 1)} mm. Indicative value, not compared with a limit.`));
  if (r.gradient > 0) {
    h += `<div class="groupe">${T('Eau', 'Water')}</div>`;
    h += constat(T('Gradient ascendant', 'Upward gradient'), cl.eau, T(
      `i = ${aff(r.gradient, 3)}. Le renard hydraulique et le soulèvement du fond restent à vérifier par ailleurs.`,
      `i = ${aff(r.gradient, 3)}. Piping and base heave remain to be checked separately.`));
  }
  if (r.alertes.length > 0) {
    h += `<div class="alertes"><h3>${T('Alertes', 'Warnings')}</h3><ul>${r.alertes.map((a) => `<li>${txt(a)}</li>`).join('')}</ul></div>`;
  }
  return h;
}

export function voletsHtml(r: Resultat): string {
  const lignes = r.combinaisons.map((x) => {
    const appuis = x.appuis.map((a) => `${echapper(a.nom)} : ${aff(a.Rh, 1)}`).join(' · ') || '—';
    return `<tr${x.nom === r.gouvernant.combinaison ? ' class="gouverne"' : ''}><td>${sym(nomCombinaison(x.nom))}</td><td class="n">${aff(x.Mmax, 1)}</td><td class="n">${aff(x.Vmax, 1)}</td><td class="n">${aff(x.Nmax, 1)}</td><td class="n">${T(appuis, appuis.replace(/ : /g, ': '))}</td><td class="n">${tauxAffiche(x.mobilisation)}</td></tr>`;
  }).join('');
  const coef = r.combinaisons.map((x) => `<p><b>${sym(nomCombinaison(x.nom))}</b></p><ul>${x.coefficients.map((k) => `<li>${sym(k.nom)} = ${aff(k.valeur, 3)}${T(' : ', ': ')}${txt(k.source)}</li>`).join('')}</ul>`).join('');
  return `<details class="deriv" open><summary>${T('Efforts par mètre de paroi', 'Forces per metre of wall')}</summary><div class="defile"><table><thead><tr><th>${T('Combinaison', 'Combination')}</th><th class="n">${sym('M_max')} (kN·m)</th><th class="n">${sym('V_max')} (kN)</th><th class="n">${sym('N_max')} (kN)</th><th class="n">${sym('R_h')} (kN)</th><th class="n">${T('butée mobilisée', 'passive mobilised')}</th></tr></thead><tbody>${lignes}</tbody></table></div></details>` +
    `<details class="deriv"><summary>${T('Coefficients et sources', 'Factors and sources')}</summary><div>${coef}</div></details>` +
    `<details class="deriv"><summary>${T('Hypothèses', 'Assumptions')}</summary><div><ul>${hypotheses().map((t) => `<li>${sym(t)}</li>`).join('')}</ul></div></details>`;
}

// -------------------------------------------------------------------------------------------------
// Entrees et resultats en lignes, pour la note et le CSV
// -------------------------------------------------------------------------------------------------

const FORMES_EN: Record<string, string> = {
  aucune: 'none', rectangle: 'rectangle', trapeze: 'trapezium', 'triangle-haut': 'triangle, maximum at the top',
  'triangle-milieu': 'triangle, maximum at mid-height', 'triangle-bas': 'triangle, maximum at the bottom', polygone: 'custom',
};

export function entreesParSection(c: Calcul): Record<'geometrie' | 'hypotheses' | 'eau', LigneResultat[]> {
  const d = c.donnees;
  const f = d.redistribution.forme;
  return {
    geometrie: [
      ligne('H', T('Hauteur retenue', 'Retained height'), `${aff(d.H, 2)} m`),
      ligne('L', T('Longueur de la paroi', 'Wall length'), `${aff(d.L, 2)} m`),
      ligne('EI', T('Rigidité en flexion', 'Bending stiffness'), `${aff(d.EI, 0)} kN·m²/m`),
      ligne('EA', T('Rigidité axiale', 'Axial stiffness'), `${aff(d.EA, 0)} kN/m`),
    ],
    hypotheses: [
      ligne('g', T('Degré d’encastrement du pied', 'Degree of toe fixity'), `${aff(d.degreEncastrement * 100, 0)} %`),
      ligne('m', T('Part de K_0 côté terre', 'Share of K_0 on the retained side'), aff(d.partK0, 2)),
      ligne('', 'Redistribution', T(f, FORMES_EN[f] ?? f)),
    ],
    eau: [
      ligne('z_w,a', T('Nappe côté terre', 'Water table, retained side'), `${aff(d.eau.zTerre, 2)} m`),
      ligne('z_w,p', T('Nappe côté fouille', 'Water table, excavation side'), `${aff(d.eau.zFouille, 2)} m`),
      ligne('', T('Écoulement autour du pied', 'Flow around the toe'), d.eau.ecoulement ? T('oui', 'yes') : T('non', 'no')),
    ],
  };
}

export const blocEntrees = (c: Calcul): LigneResultat[] => {
  const e = entreesParSection(c);
  return [...e.geometrie, ...e.hypotheses, ...e.eau];
};

export function blocsResultat(r: Resultat): BlocResultat[] {
  const mob = T('Part de butée mobilisée', 'Share of passive resistance mobilised');
  return [
    {
      titre: T('Synthèse', 'Summary'),
      note: null,
      lignes: [
        ligne('', T('Combinaison gouvernante', 'Governing combination'), nomCombinaison(r.gouvernant.combinaison)),
        ligne(T('taux', 'ratio'), mob, tauxAffiche(r.gouvernant.mobilisation)),
        ligne('M_d', T('Moment de calcul, enveloppe', 'Design moment, envelope'), `${aff(r.Md, 1)} kN·m/m`),
        ligne('V_d', T('Effort tranchant de calcul, enveloppe', 'Design shear force, envelope'), `${aff(r.Vd, 1)} kN/m`),
        ligne('w_max', T('Déplacement maximal, indicatif', 'Maximum displacement, indicative'), `${aff(r.service.wMax, 1)} mm`),
      ],
    },
    ...r.combinaisons.map((x): BlocResultat => ({
      titre: nomCombinaison(x.nom),
      note: null,
      lignes: [
        ligne(T('taux', 'ratio'), mob, tauxAffiche(x.mobilisation)),
        ligne('d_min', T('Fiche minimale', 'Minimum embedment'), x.ficheMinimale === null ? T('aucune', 'none') : `${aff(x.ficheMinimale, 2)} m`),
        ligne('M_max', T('Moment maximal', 'Maximum moment'), `${aff(x.Mmax, 1)} kN·m/m`),
        ligne('V_max', T('Effort tranchant maximal', 'Maximum shear force'), `${aff(x.Vmax, 1)} kN/m`),
        ligne('N_max', T('Effort normal maximal', 'Maximum axial force'), `${aff(x.Nmax, 1)} kN/m`),
        ...x.appuis.flatMap((a) => [
          ligne(`R_h,${a.nom}`, `${T('Réaction horizontale', 'Horizontal reaction')} ${a.nom}`, `${aff(a.Rh, 1)} kN/m`),
          ligne(`T_${a.nom}`, `${T('Effort axial par appui', 'Axial force per support')} ${a.nom}`, `${aff(a.axial, 1)} kN`),
        ]),
      ],
    })),
  ];
}

export const messageDErreur = (e: unknown): string => phrase(e instanceof Error ? e.message : String(e));

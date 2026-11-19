/** Presentation : listes de saisie, cartes de verdict, volets, blocs de resultats. Mise en forme pure : aucun calcul. */

import { echapper, nombreAffiche, notationHtml, tauxAffiche, traduireSource, type BlocResultat, type LigneResultat, type VerificationNote } from 'aedificium-ui';
import { verifierAcier, type ElementAcier } from '../../src/acier';
import { verifierFond, type ResultatFond } from '../../src/fond';
import type { ResultatPhases } from '../../src/phases';
import { calculDePhase, modeleBande, type Calcul, type Resultat, type Saisie } from './form';
import { phrase, T } from './textes';

type Combi = Resultat['combinaisons'][number];

export const aff = (v: number, d: number): string => (Number.isFinite(v) ? nombreAffiche(v, d) : T('non calculable', 'not computable'));
const sym = (s: string): string => notationHtml(s);
/** Phrase du noyau, traduite au besoin, mise en forme. */
const txt = (s: string): string => notationHtml(phrase(s));
/** Source d un coefficient : les sources ILNAS (annexe LU) par traduireSource, les autres par phrase. */
export const sourceAffichee = (s: string): string => (s.startsWith('ILNAS') ? traduireSource(s) : phrase(s));
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
  T('Eau sur la paroi : hydrostatique, ou gradient uniforme i = Δh / longueur du chemin autour du pied.',
    'Water on the wall: hydrostatic, or uniform gradient i = Δh / length of the flow path around the toe.'),
  T('Lierne : T·a²/10 si continue, T·a²/8 sur deux appuis, choix de l’outil.',
    'Waler: T·a²/10 if continuous, T·a²/8 simply supported, a choice of the tool.'),
  T('Déplacement w : ligne élastique EI·w″ = M sous charges caractéristiques. Indicatif : ni phasage ni rigidité du sol (D.8).',
    'Displacement w: elastic line EI·w″ = M under characteristic loads. Indicative: neither staging nor ground stiffness (D.8).'),
  T('Soulèvement hydraulique au pied, côté fouille : Δu = γw·h_r, h_r = h / (1 + ∛(h′/t + 1)) (formule approchée de l’EAU, sol homogène, fouille large ; h perte de charge, t = L − z_fouille, h′ chemin dans le sol côté terre au-dessus du niveau d’eau côté fouille), comparé à 0,67 fois la contrainte verticale effective (2e génération, EN 1997-1:2024, 8.1.4.2) ; 1re génération : γG;dst = 1,35 sur Δu et γG;stb = 0,9 sur le poids déjaugé (EN 1997-1:2004, 2.4.7.5).',
    'Hydraulic heave at the toe, excavation side: Δu = γw·h_r, h_r = h / (1 + ∛(h′/t + 1)) (approximate EAU formula, homogeneous ground, wide excavation; h head loss, t = L − z_excavation, h′ flow path in the ground on the retained side above the excavation-side water level), compared with 0.67 times the effective vertical stress (2nd generation, EN 1997-1:2024, 8.1.4.2); 1st generation: γG;dst = 1.35 on Δu and γG;stb = 0.9 on the submerged weight (EN 1997-1:2004, 2.4.7.5).'),
  T('Soulèvement du fond en sol fin non drainé seulement : Bjerrum et Eide, formules D.24 à D.26 ; charges, γcu et γRe selon chaque combinaison. Équilibre vertical : D.12 intégré sur toute la hauteur, choix de l’outil.',
    'Basal heave in undrained fine soil only: Bjerrum and Eide, formulas D.24 to D.26; actions, γcu and γRe per combination. Vertical equilibrium: D.12 integrated over the full height, a choice of the tool.'),
  T('Acier (EN 1993-1-1, 6.2 et 6.3) : enveloppe des combinaisons. Profilés de berlinoise : M_d, V_d et N_max par mètre multipliés par l’entraxe, longueurs de flambement et de déversement égales à la longueur de la paroi. Buton : compression maximale seule, sur sa longueur libre. Lierne : M de la lierne, V = 0,6 R_h·a si continue ou 0,5 R_h·a sur deux appuis, longueurs égales à l’entraxe. C1 = 1, déversement non empêché, poids propre négligé ; choix de l’outil.',
    'Steel (EN 1993-1-1, 6.2 and 6.3): envelope of the combinations. Soldier piles: M_d, V_d and N_max per metre multiplied by the spacing, buckling and lateral-torsional lengths equal to the wall length. Strut: maximum compression only, over its free length. Waler: waler moment, V = 0.6 R_h·a if continuous or 0.5 R_h·a if simply supported, lengths equal to the spacing. C1 = 1, lateral-torsional buckling unrestrained, self-weight neglected; a choice of the tool.'),
];

export function nomCombinaison(nom: string): string {
  if (nom === '(a)') return T('(a) VC4 + M1, effets × γ_E', '(a) VC4 + M1, effects × γ_E');
  if (nom === '(b)') return '(b) VC3 + M2';
  if (nom === '(d)') return T('(d) VC1, résistance γ_Re', '(d) VC1, resistance γ_Re');
  return nom;
}

export const clauses = (g: 1 | 2) => (g === 2
  ? { rotation: T('EN 1997-3:2025, 7.6.3 et D.8', 'EN 1997-3:2025, 7.6.3 and D.8'), paroi: '7.6.8', appui: '7.6.7', service: T('7.7 et D.8', '7.7 and D.8'), eau: '7.6.6',
    hyd: 'EN 1997-1:2024, 8.1.4.2', fond: '7.6.6, D.24', vertical: '7.6.4, D.12' }
  : { rotation: 'EN 1997-1:2004, 9.7.4', paroi: '9.7.6', appui: '9.7.7', service: '9.8', eau: '2.4.7.5',
    hyd: 'EN 1997-1:2004, 2.4.7.5', fond: '7.6.6, D.24', vertical: 'EN 1997-1:2004, 9.7.5' });

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
    champ(T('Profilé du buton', 'Strut section'), 'appuis', i, 'profilButon', a.profilButon, T('aucun', 'none')) +
    champ(T('Profilé de la lierne', 'Waler section'), 'appuis', i, 'profilLierne', a.profilLierne, T('aucun', 'none')) +
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

/** Phases de construction : surexcavation, tableau des phases intermediaires et ligne finale grisee. */
export function phasesHtml(s: Saisie): string {
  if (!s.phasage) return '';
  const caseAppui = (i: number, nom: string, coche: boolean): string =>
    `<label class="case"><input type="checkbox" data-liste="phases" data-i="${i}" data-appui="${echapper(nom)}"${coche ? ' checked' : ''}> ${echapper(nom)}</label>`;
  const saisi = (i: number, sous: string, v: string, etiquette: string): string =>
    `<input type="text" inputmode="decimal" aria-label="${etiquette}" data-liste="phases" data-i="${i}" data-sous="${sous}" value="${echapper(v)}">`;
  const fond = T('Fond (m)', 'Level (m)');
  const eau = T('Eau (m)', 'Water (m)');
  const lignes = s.phases.map((p, i) => `<tr><td>${i + 1}</td><td>${saisi(i, 'H', p.H, `Phase ${i + 1}, ${fond}`)}</td>` +
    `<td class="appuis">${s.appuis.map((a) => caseAppui(i, a.nom, p.appuis.includes(a.nom))).join('') || '—'}</td>` +
    `<td>${saisi(i, 'zEau', p.zEau, `Phase ${i + 1}, ${eau}`)}</td>` +
    `<td><button type="button" data-action="retirer" data-liste="phases" data-i="${i}" aria-label="${T('Retirer', 'Remove')}">−</button></td></tr>`).join('');
  const finale = `<tr class="finale"><td>${s.phases.length + 1}</td><td>${echapper(s.H)}</td><td class="appuis">${s.appuis.map((a) => echapper(a.nom)).join(', ') || '—'}</td><td>${echapper(s.zFouille)}</td><td></td></tr>`;
  return `<label class="ligne"><span>${T('Surexcavation sous chaque appui (m)', 'Over-excavation below each support (m)')}</span><input type="text" inputmode="decimal" data-champ="surexcavation" value="${echapper(s.surexcavation)}"></label>` +
    `<div class="defile"><table class="phases"><thead><tr><th>Ph.</th><th>${fond}</th><th>${T('Appuis', 'Supports')}</th><th>${eau}</th><th></th></tr></thead><tbody>${lignes}${finale}</tbody></table></div>` +
    `<span class="source">${T('La dernière ligne est la configuration finale (saisie ci-dessus). Chaque phase est calculée seule, sans historique.', 'The last row is the final configuration (input above). Each phase is calculated on its own, without history.')}</span>` +
    `<div class="boutons"><button type="button" data-action="generer-phases">${T('Générer les phases', 'Generate the phases')}</button><button type="button" data-action="ajouter" data-liste="phases">+ phase</button></div>`;
}

// -------------------------------------------------------------------------------------------------
// Verdicts
// -------------------------------------------------------------------------------------------------

type Verification = 'rotation' | 'acier' | 'hyd' | 'fond' | 'vertical';

function carteTaux(titre: string, clause: string, taux: number, corps: string, gouvernant: boolean, verification: Verification = 'rotation'): string {
  const classe = Number.isFinite(taux) && taux <= 1 ? 'ok' : 'refus';
  const largeur = Number.isFinite(taux) ? Math.min(100, Math.max(0, taux * 100)) : 100;
  return `<div class="verdict ${classe}" data-verification="${verification}"><h3><span>${sym(titre)}${gouvernant ? ` · ${T('gouvernant', 'governing')}` : ''}</span> <span class="clause">${clause}</span></h3>` +
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

export const titreAcier = (e: ElementAcier): string => (e.type === 'paroi'
  ? T('Profilés de berlinoise', 'Soldier piles')
  : e.type === 'buton' ? `${T('Buton', 'Strut')} ${e.nom}` : `${T('Lierne', 'Waler')} ${e.nom}`);

const corpsAcier = (e: ElementAcier): string => {
  const erreur = e.erreur === 'profil' ? T('Profilé absent du catalogue.', 'Section not in the catalogue.')
    : e.erreur === 'longueur' ? T('Longueur libre du buton à renseigner.', 'Free length of the strut required.') : '';
  const nombres = `${echapper(e.profil)} ${e.nuance}${T(' : ', ': ')}N = ${aff(e.N, 1)} kN${T(' ; ', '; ')}M = ${aff(e.M, 1)} kN·m${T(' ; ', '; ')}V = ${aff(e.V, 1)} kN${T(' ; ', '; ')}L = ${aff(e.longueur, 2)} m.`;
  return erreur === '' ? nombres : `${nombres} ${erreur}`;
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
  const elementsAcier = verifierAcier(c.donnees, r, c.acier);
  if (elementsAcier.length > 0) {
    h += `<div class="groupe">${T('Acier, EN 1993-1-1', 'Steel, EN 1993-1-1')}</div>`;
    for (const e of elementsAcier) h += carteTaux(titreAcier(e), '6.2, 6.3', e.taux === null ? Infinity : e.taux, corpsAcier(e), false, 'acier');
  }
  const fond = verifierFond(c.donnees, r);
  h += `<div class="groupe">${T('Fond de fouille et équilibre vertical', 'Excavation base and vertical equilibrium')}</div>`;
  if (fond.hyd !== null) {
    const v = fond.hyd;
    h += carteTaux(T('Soulèvement hydraulique', 'Hydraulic heave'), cl.hyd, v.taux,
      `i = ${aff(v.gradient, 3)}${T(' ; ', '; ')}Δu = ${aff(v.du, 1)} kPa${T(' ; ', '; ')}${sym('σ′_v0')} = ${aff(v.sigma, 1)} kPa.`, false, 'hyd');
  }
  if (fond.fond.applicable) {
    for (const x of fond.fond.combinaisons) {
      const corps = `${sym('N_c')} = ${aff(x.Nc, 2)}${T(' ; ', '; ')}${sym('c_u,d')} = ${aff(x.cu, 1)} kPa${T(' ; ', '; ')}${sym('E_d')} = ${aff(x.Ed, 1)} kPa${T(' ; ', '; ')}${sym('R_d')} = ${aff(x.Rd, 1)} kPa.`;
      h += carteTaux(`${T('Soulèvement du fond', 'Basal heave')} · ${nomCombinaison(x.combinaison)}`, cl.fond, x.taux, corps, false, 'fond');
    }
  } else if (fond.fond.motif === 'largeur') {
    h += constat(T('Soulèvement du fond', 'Basal heave'), cl.fond,
      T('Largeur de fouille non saisie : soulèvement du fond non vérifié.', 'Excavation width not given: basal heave not checked.'));
  }
  for (const v of fond.vertical) {
    const corps = T(
      `Butée vers le haut ${aff(v.buteeHaut, 1)} kN/m ; vers le bas : appuis ${aff(v.appuisBas, 1)}, poussée ${aff(v.pousseeBas, 1)}, poids de la paroi ${aff(v.poidsParoi, 1)} kN/m ; force nette en pied à reprendre ${aff(v.netBas, 1)} kN/m (outil Pieux).`,
      `Passive resistance upwards ${aff(v.buteeHaut, 1)} kN/m; downwards: supports ${aff(v.appuisBas, 1)}, earth thrust ${aff(v.pousseeBas, 1)}, wall weight ${aff(v.poidsParoi, 1)} kN/m; net force at the toe to be resisted ${aff(v.netBas, 1)} kN/m (Piles tool).`);
    h += carteTaux(`${T('Équilibre vertical', 'Vertical equilibrium')} · ${nomCombinaison(v.combinaison)}`, cl.vertical, v.taux, corps, false, 'vertical');
  }
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

export type Verif = VerificationNote & { taux: number };

/** Verifications d'un calcul (une phase ou la configuration finale), noms prefixes. */
export function verificationsDe(calcul: Calcul, r: Resultat, fond: ResultatFond, prefixe: string): Verif[] {
  const acier = verifierAcier(calcul.donnees, r, calcul.acier);
  const cl = clauses(r.generation);
  return [
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
    ...(fond.hyd === null ? [] : [{
      nom: T('Soulèvement hydraulique', 'Hydraulic heave'),
      clause: cl.hyd,
      taux: fond.hyd.taux,
      ok: fond.hyd.taux <= 1,
    }]),
    ...(fond.fond.applicable ? fond.fond.combinaisons.map((x) => ({
      nom: `${T('Soulèvement du fond', 'Basal heave')} · ${nomCombinaison(x.combinaison)}`,
      clause: cl.fond,
      taux: x.taux,
      ok: x.taux <= 1,
    })) : []),
    ...fond.vertical.map((v) => ({
      nom: `${T('Équilibre vertical', 'Vertical equilibrium')} · ${nomCombinaison(v.combinaison)}`,
      clause: cl.vertical,
      taux: v.taux,
      ok: v.taux <= 1,
    })),
  ].map((v) => ({ ...v, nom: prefixe + v.nom }));
}


/** Verdicts du calcul phase : la pire verification de chaque phase, puis le detail de la phase determinante. */
export function verdictsPhasesHtml(c: Calcul, rp: ResultatPhases): string {
  const n = rp.phases.length;
  let h = `<div class="groupe">${T('Phases de construction', 'Construction phases')}</div>`;
  rp.phases.forEach((x, i) => {
    const v = verificationsDe(calculDePhase(c, x.phase, i === n - 1), x.resultat, x.fond, '');
    // Taux non calculable (NaN, acier en erreur) : pire que tout.
    const cle = (y: Verif): number => (Number.isNaN(y.taux) ? Infinity : y.taux);
    const pire = v.reduce((a, b) => (cle(b) > cle(a) ? b : a));
    const refus = v.filter((y) => !y.ok).length;
    const corps = T(`Fond ${aff(x.phase.H, 2)} m ; appuis : ${x.phase.appuis.join(', ') || 'aucun'} ; ${v.length} vérifications, ${refus} non satisfaite(s). Pire : ${pire.nom}.`,
      `Level ${aff(x.phase.H, 2)} m; supports: ${x.phase.appuis.join(', ') || 'none'}; ${v.length} checks, ${refus} not satisfied. Worst: ${pire.nom}.`);
    const det = x.phase.nom === rp.determinante.phase ? T(' Phase déterminante pour la butée.', ' Governing phase for passive resistance.') : '';
    h += carteTaux(x.phase.nom, pire.clause ?? '', cle(pire), corps + det, false);
  });
  const k = rp.phases.findIndex((x) => x.phase.nom === rp.determinante.phase);
  const det = rp.phases[k];
  h += `<div class="groupe">${T('Phase déterminante', 'Governing phase')} : ${det.phase.nom}</div>`.replace(' : ', T(' : ', ': '));
  return h + verdictsHtml(calculDePhase(c, det.phase, k === n - 1), det.resultat);
}

/** Tableau des phases : fond, appuis, fiche, M_max, reactions, taux ; ligne d'enveloppe. */
export function tableauPhasesHtml(c: Calcul, rp: ResultatPhases): string {
  const noms = c.donnees.appuis.map((a) => a.nom);
  const lignes = rp.phases.map((x) => {
    const ks = x.resultat.combinaisons;
    const fiches = ks.map((k) => k.ficheMinimale);
    const fiche = fiches.some((f) => f === null) ? '—' : aff(Math.max(...(fiches as number[])), 2);
    const Rh = noms.map((nom) => {
      const r = ks.flatMap((k) => k.appuis.filter((a) => a.nom === nom).map((a) => Math.abs(a.Rh)));
      return r.length === 0 ? '—' : aff(Math.max(...r), 1);
    });
    const taux = Math.max(...ks.map((k) => k.mobilisation));
    return `<tr${x.phase.nom === rp.determinante.phase ? ' class="gouverne"' : ''}><td>${x.phase.nom}</td><td class="n">${aff(x.phase.H, 2)}</td><td>${x.phase.appuis.join(', ') || '—'}</td><td class="n">${fiche}</td><td class="n">${aff(x.resultat.Md, 1)}</td>${Rh.map((v) => `<td class="n">${v}</td>`).join('')}<td class="n">${tauxAffiche(taux)}</td></tr>`;
  }).join('');
  const L = rp.longueurRequise;
  const env = `<tr class="enveloppe"><td>${T('Enveloppe', 'Envelope')}</td><td></td><td></td><td class="n">${L.valeur === null ? '—' : `L ≥ ${aff(L.valeur, 2)}`}</td><td class="n">${aff(rp.Md, 1)}</td>${rp.appuis.map((a) => `<td class="n">${aff(a.Rh, 1)}</td>`).join('')}<td class="n">${tauxAffiche(rp.determinante.mobilisation)}</td></tr>`;
  return `<details class="deriv" open><summary>${T('Phases de construction', 'Construction phases')}</summary><div class="defile"><table><thead><tr><th>Phase</th><th class="n">${T('Fond (m)', 'Level (m)')}</th><th>${T('Appuis', 'Supports')}</th><th class="n">${T('Fiche min. (m)', 'Min. embedment (m)')}</th><th class="n">${sym('M_max')} (kN·m)</th>${noms.map((nm) => `<th class="n">${sym('R_h')} ${echapper(nm)} (kN)</th>`).join('')}<th class="n">${T('butée mobilisée', 'passive mobilised')}</th></tr></thead><tbody>${lignes}${env}</tbody></table></div></details>`;
}

export function voletsHtml(r: Resultat): string {
  const lignes = r.combinaisons.map((x) => {
    const appuis = x.appuis.map((a) => `${echapper(a.nom)} : ${aff(a.Rh, 1)}`).join(' · ') || '—';
    return `<tr${x.nom === r.gouvernant.combinaison ? ' class="gouverne"' : ''}><td>${sym(nomCombinaison(x.nom))}</td><td class="n">${aff(x.Mmax, 1)}</td><td class="n">${aff(x.Vmax, 1)}</td><td class="n">${aff(x.Nmax, 1)}</td><td class="n">${T(appuis, appuis.replace(/ : /g, ': '))}</td><td class="n">${tauxAffiche(x.mobilisation)}</td></tr>`;
  }).join('');
  const coef = r.combinaisons.map((x) => `<p><b>${sym(nomCombinaison(x.nom))}</b></p><ul>${x.coefficients.map((k) => `<li>${sym(k.nom)} = ${aff(k.valeur, 3)}${T(' : ', ': ')}${notationHtml(sourceAffichee(k.source))}</li>`).join('')}</ul>`).join('');
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

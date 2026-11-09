/**
 * Langue de l'interface. PUR. Aucun texte ne se fige au chargement : `T()` et `phrase()` se lisent au rendu.
 * `phrase` traduit les phrases francaises du noyau et de sol-ec7 (refus, alertes, sources des coefficients).
 */

import { langueCourante, pointDecimal, traducteur, type RegleDePhrase } from 'aedificium-ui';

/** Texte selon la langue courante. */
export const T = (fr: string, en: string): string => (langueCourante() === 'en' ? en : fr);

const EXACTES: Record<string, string> = {
  'Polygone de redistribution : il doit aller de z/H = 0 à z/H = 1.': 'Redistribution polygon: it must run from z/H = 0 to z/H = 1.',
  'Système instable : vérifier les appuis et le pied de la paroi.': 'Unstable system: check the supports and the toe of the wall.',
  'La longueur de la paroi doit dépasser la hauteur retenue.': 'The wall length must exceed the retained height.',
  'Au moins une couche est requise.': 'At least one layer is required.',
  'Part de K0 : entre 0 et 1.': 'Share of K0: between 0 and 1.',
  'Degré d’encastrement : entre 0 et 1.': 'Degree of toe fixity: between 0 and 1.',
  'Sans appui porteur, le pied doit être encastré à 100 % (console).': 'Without a load-bearing support, the toe must be 100 % fixed (cantilever).',
  'Charge en bande : distance positive et largeur strictement positive.': 'Strip load: positive distance and strictly positive width.',
  'Pression imposée : z2 doit dépasser z1.': 'Imposed pressure: z2 must exceed z1.',
  'Butée insuffisante : augmenter la fiche.': 'Insufficient passive resistance: increase the embedment.',
  'φ supérieur à 40° : coefficients de butée à apprécier avec prudence (7.5.3.3).': 'φ above 40°: passive coefficients to be used with caution (7.5.3.3).',
  'Le 7.4.1 demande une situation accidentelle avec nappe en surface, sauf drainage ou impossibilité : à vérifier.':
    '7.4.1 requires an accidental situation with the water table at the surface, unless drained or impossible: to be checked.',
  'Paroi appuyée sans redistribution : la pression réelle se reporte vers les appuis (D.8, 7.5.3.1).':
    'Supported wall without redistribution: the actual pressure shifts towards the supports (D.8, 7.5.3.1).',
  'Déplacements : ligne élastique de la paroi, indicative ; l’équilibre limite ignore le phasage et la rigidité du sol (D.8).':
    'Displacements: elastic line of the wall, indicative; limit equilibrium ignores staging and ground stiffness (D.8).',
};

const REGLES: RegleDePhrase[] = [
  [/^(.+) : valeur strictement positive attendue\.$/, (_m, n) => `${n}: strictly positive value expected.`],
  [/^(.+) : angle de frottement entre 0 et 60°\.$/, (_m, n) => `${n}: friction angle between 0 and 60°.`],
  [/^(.+) : cohésion négative ou invalide\.$/, (_m, n) => `${n}: negative or invalid cohesion.`],
  [/^(.+) : un sol sans frottement exige une cohésion\.$/, (_m, n) => `${n}: a soil without friction requires a cohesion.`],
  [/^(.+) : k_tan δ entre 0 et 1 \(7\.5\.2\)\.$/, (_m, n) => `${n}: k_tan δ between 0 and 1 (7.5.2).`],
  [/^(.+) : niveau entre la tête et le fond de fouille\.$/, (_m, n) => `${n}: level between the head and the excavation base.`],
  [/^(.+) : effort imposé strictement positif\.$/, (_m, n) => `${n}: strictly positive imposed force.`],
  [/^(.+) : EA et longueur vont ensemble\.$/, (_m, n) => `${n}: EA and length go together.`],
  [/^(.+) : EA et longueur strictement positifs\.$/, (_m, n) => `${n}: EA and length strictly positive.`],
  [/^Gradient ascendant (.+) supérieur au gradient critique : vérifier le renard hydraulique\.$/,
    (_m, i) => `Upward gradient ${i} above the critical gradient: check piping.`],
];

/** Mots des sources et libelles, apres les phrases connues. */
const MOTS: [RegExp, string][] = [
  [/modifié par l’utilisateur \(bibliothèque : ([^)]*)\)/g, 'modified by the user (library: $1)'],
  [/valeurs recommandées/g, 'recommended values'],
  [/valeur recommandée/g, 'recommended value'],
  [/tableau/g, 'Table'],
  [/\bjeu\b/g, 'set'],
  [/\bet\b/g, 'and'],
  [/approche par les matériaux, sans facteur de résistance/g, 'material factor approach, no resistance factor'],
  [/sans coefficient/g, 'no factor'],
  [/action variable favorable : 0/g, 'favourable variable action: 0'],
  [/× facteur de conséquence/g, '× consequence factor'],
  [/risque (faible|normal|élevé)/g, (_m: string, r: string) => `${r === 'faible' ? 'low' : r === 'normal' ? 'normal' : 'high'} risk`] as unknown as [RegExp, string],
  [/épaisseur/g, 'thickness'], [/niveau/g, 'level'], [/inclinaison/g, 'inclination'], [/entraxe/g, 'spacing'],
  [/effort imposé/g, 'imposed force'], [/longueur/g, 'length'], [/Hauteur retenue/g, 'Retained height'],
  [/Longueur de la paroi/g, 'Wall length'], [/Rigidité/g, 'Stiffness'], [/Charge (\d+)/g, 'Load $1'],
];

const exactes = traducteur(EXACTES, REGLES);

export function phrase(s: string): string {
  if (langueCourante() === 'fr') return s;
  let t = exactes(s);
  if (t === pointDecimal(s)) for (const [m, r] of MOTS) t = t.replace(m, r as string);
  return t;
}

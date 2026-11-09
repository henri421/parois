/** Cablage de l'interface des parois. Ne calcule rien : tient la saisie, appelle le noyau par `form`. */

import { blocsEnTexte, definirLangue, langueDuDocument, noteDeCalculHtml, notationHtml, ouvrirOuTelecharger, resultatsEnCsv, svgAutonome, telecharger } from 'aedificium-ui';
import { coupeEtDiagrammes, type OptionsDessin } from './dessin';
import { lireSaisie, longueurProposee, nouvelAppui, nouvelleCharge, relire, saisieParDefaut, serialiser, verifier, type Calcul, type Resultat, type Saisie } from './form';
import { noteDuCalcul } from './note';
import { appuisHtml, blocEntrees, blocsResultat, chargesHtml, couchesHtml, messageDErreur, nomCombinaison, verdictsHtml, voletsHtml } from './vue';
import './style.css';

definirLangue(langueDuDocument(document));

const CLE_SAISIE = 'parois/saisie';
const CLE_CARTOUCHE = 'parois:cartouche';

function exige<T extends Element>(selecteur: string): T {
  const e = document.querySelector<T>(selecteur);
  if (e === null) throw new Error(`Élément de page absent : ${selecteur}.`);
  return e;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const zones = {
  erreur: exige<HTMLElement>('[data-role="erreur"]'),
  couches: exige<HTMLElement>('[data-role="couches"]'),
  appuis: exige<HTMLElement>('[data-role="appuis"]'),
  charges: exige<HTMLElement>('[data-role="charges"]'),
  coupe: exige<HTMLElement>('[data-role="coupe"]'),
  verdicts: exige<HTMLElement>('[data-role="verdicts"]'),
  volets: exige<HTMLElement>('[data-role="volets"]'),
};
const selectCombinaison = exige<HTMLSelectElement>('[data-role="combinaison"]');
const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');

type Racine = Record<string, unknown>;

function charger(): Saisie | null {
  try {
    const t = window.localStorage.getItem(CLE_SAISIE);
    return t === null ? null : relire(t);
  } catch {
    return null;
  }
}

let saisie: Saisie = charger() ?? saisieParDefaut();
let dernier: { calcul: Calcul; resultat: Resultat } | null = null;

function memoriser(): void {
  try {
    window.localStorage.setItem(CLE_SAISIE, serialiser(saisie));
  } catch {
    // Stockage indisponible : la page fonctionne sans.
  }
}

function montrerErreur(m: string | null): void {
  zones.erreur.hidden = m === null;
  zones.erreur.innerHTML = m === null ? '' : notationHtml(m);
}

function ajusterAffichage(): void {
  for (const b of formulaire.querySelectorAll<HTMLButtonElement>('[data-generation]')) {
    b.setAttribute('aria-pressed', String(b.dataset.generation === saisie.generation));
  }
  const conditions: [string, string][] = [['data-si-generation', saisie.generation], ['data-si-profil', saisie.profil], ['data-si-forme', saisie.forme]];
  for (const [attribut, valeur] of conditions) {
    for (const z of formulaire.querySelectorAll<HTMLElement>(`[${attribut}]`)) z.hidden = z.getAttribute(attribut) !== valeur;
  }
}

function ecrireSaisie(): void {
  for (const e of formulaire.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-champ]')) {
    const v = (saisie as unknown as Racine)[e.dataset.champ ?? ''];
    if (e instanceof HTMLInputElement && e.type === 'checkbox') e.checked = v === true;
    else e.value = String(v);
  }
}

function rendreListes(): void {
  zones.couches.innerHTML = couchesHtml(saisie);
  zones.appuis.innerHTML = appuisHtml(saisie);
  zones.charges.innerHTML = chargesHtml(saisie);
}

const option = (n: 'q' | 'V' | 'M' | 'w' | 'cotes'): boolean => exige<HTMLInputElement>(`[data-option="${n}"]`).checked;

function optionsDessin(r: Resultat): OptionsDessin {
  return { q: option('q'), V: option('V'), M: option('M'), w: option('w'), cotes: option('cotes'), combinaison: selectCombinaison.value || r.gouvernant.combinaison };
}

function renduDessin(): void {
  zones.coupe.innerHTML = dernier === null ? '' : coupeEtDiagrammes(dernier.calcul, dernier.resultat, optionsDessin(dernier.resultat));
}

function remplirCombinaisons(r: Resultat): void {
  const avant = selectCombinaison.value;
  const noms = r.combinaisons.map((c) => c.nom);
  selectCombinaison.innerHTML = r.combinaisons.map((c) => `<option value="${c.nom}">${nomCombinaison(c.nom).replace('γ_E', 'γE').replace('γ_Re', 'γRe')}</option>`).join('');
  selectCombinaison.value = noms.includes(avant) ? avant : r.gouvernant.combinaison;
}

function viderResultats(): void {
  dernier = null;
  zones.verdicts.innerHTML = '';
  zones.volets.innerHTML = '';
  renduDessin();
}

function recalculer(): void {
  memoriser();
  ajusterAffichage();
  const lecture = lireSaisie(saisie);
  if (!lecture.ok) {
    montrerErreur(lecture.message);
    return viderResultats();
  }
  let resultat: Resultat;
  try {
    resultat = verifier(lecture.calcul);
  } catch (e) {
    montrerErreur(messageDErreur(e));
    return viderResultats();
  }
  montrerErreur(null);
  dernier = { calcul: lecture.calcul, resultat };
  remplirCombinaisons(resultat);
  zones.verdicts.innerHTML = verdictsHtml(lecture.calcul, resultat);
  zones.volets.innerHTML = voletsHtml(resultat);
  renduDessin();
}

function lireEdition(cible: EventTarget | null): void {
  if (!(cible instanceof HTMLInputElement || cible instanceof HTMLSelectElement)) return;
  const d = cible.dataset;
  const coche = cible instanceof HTMLInputElement && cible.type === 'checkbox';
  const valeur = coche ? (cible as HTMLInputElement).checked : cible.value;
  if (d.champ !== undefined) {
    (saisie as unknown as Racine)[d.champ] = valeur;
  } else if (d.liste === 'couches' || d.liste === 'appuis' || d.liste === 'charges') {
    const element = saisie[d.liste][Number(d.i)] as unknown as Racine | undefined;
    if (element === undefined || d.sous === undefined) return;
    element[d.sous] = valeur;
    if (d.liste === 'charges' && d.sous === 'type') zones.charges.innerHTML = chargesHtml(saisie);
  } else {
    return;
  }
  recalculer();
}

formulaire.addEventListener('input', (e) => lireEdition(e.target));
for (const o of document.querySelectorAll<HTMLInputElement>('[data-option]')) o.addEventListener('input', renduDessin);
selectCombinaison.addEventListener('input', renduDessin);

const cartouche = () => ({ projet: champProjet.value, element: champElement.value, date: new Date().toISOString().slice(0, 10) });

function ajouter(liste: string): void {
  if (liste === 'couches') {
    const n = saisie.couches.length + 1;
    saisie.couches.push({ ...saisie.couches[saisie.couches.length - 1], nom: `Couche ${n}`, h: '1' });
  }
  if (liste === 'appuis') saisie.appuis.push(nouvelAppui(saisie.appuis.length + 1));
  if (liste === 'charges') saisie.charges.push(nouvelleCharge());
}

function retirer(liste: string, i: number): void {
  if (liste === 'couches' && saisie.couches.length > 1) saisie.couches.splice(i, 1);
  if (liste === 'appuis') saisie.appuis.splice(i, 1);
  if (liste === 'charges') saisie.charges.splice(i, 1);
}

document.addEventListener('click', (evenement) => {
  if (!(evenement.target instanceof HTMLElement)) return;
  const bouton = evenement.target.closest('button');
  if (bouton === null) return;
  const d = bouton.dataset;
  if (d.generation === '1re' || d.generation === '2e') {
    saisie.generation = d.generation;
    return recalculer();
  }
  const action = d.action;
  if (action === undefined) return;
  if ((action === 'ajouter' || action === 'retirer') && d.liste !== undefined) {
    if (action === 'ajouter') ajouter(d.liste);
    else retirer(d.liste, Number(d.i));
    rendreListes();
    return recalculer();
  }
  if (action === 'trouver-fiche') {
    if (dernier === null) return montrerErreur('Aucun calcul valide : corriger la saisie.');
    const L = longueurProposee(dernier.calcul, dernier.resultat);
    if (L === null) return montrerErreur('Aucune longueur n’équilibre la paroi avec cette saisie.');
    saisie.L = L;
    ecrireSaisie();
    return recalculer();
  }
  if (action === 'enregistrer') return telecharger('parois.json', serialiser(saisie), 'application/json;charset=utf-8');
  if (action === 'reinitialiser') {
    saisie = saisieParDefaut();
    ecrireSaisie();
    rendreListes();
    return recalculer();
  }
  if (!action.startsWith('exporter-')) return;
  if (dernier === null) return montrerErreur('Aucun calcul valide à exporter : corriger la saisie.');
  const e = dernier;
  if (action === 'exporter-note') {
    ouvrirOuTelecharger('parois-note.html', noteDeCalculHtml(noteDuCalcul(e.calcul, e.resultat, cartouche()), ''));
  } else if (action === 'exporter-coupe') {
    telecharger('parois-coupe.svg', svgAutonome(coupeEtDiagrammes(e.calcul, e.resultat, optionsDessin(e.resultat)), ''), 'image/svg+xml;charset=utf-8');
  } else if (action === 'exporter-resultats') {
    const blocs = [{ titre: 'Données', lignes: blocEntrees(e.calcul), note: null }, ...blocsResultat(e.resultat)];
    telecharger('parois-resultats.csv', resultatsEnCsv(blocsEnTexte(blocs)), 'text/csv;charset=utf-8');
  }
});

exige<HTMLInputElement>('[data-role="ouvrir"]').addEventListener('change', async (e) => {
  const entree = e.target as HTMLInputElement;
  const f = entree.files?.[0];
  entree.value = '';
  if (f === undefined) return;
  try {
    saisie = relire(await f.text());
  } catch (err) {
    return montrerErreur(messageDErreur(err));
  }
  ecrireSaisie();
  rendreListes();
  recalculer();
});

try {
  const c = JSON.parse(window.localStorage.getItem(CLE_CARTOUCHE) ?? '{}') as { projet?: unknown; element?: unknown };
  champProjet.value = typeof c.projet === 'string' ? c.projet : '';
  champElement.value = typeof c.element === 'string' ? c.element : '';
} catch {
  // Cartouche illisible : champs vides.
}
for (const champ of [champProjet, champElement]) {
  champ.addEventListener('input', () => {
    try {
      window.localStorage.setItem(CLE_CARTOUCHE, JSON.stringify({ projet: champProjet.value, element: champElement.value }));
    } catch {
      // Stockage indisponible : la page fonctionne sans.
    }
  });
}

ecrireSaisie();
rendreListes();
recalculer();

// Hors navigateur (tests), pas de service worker.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}

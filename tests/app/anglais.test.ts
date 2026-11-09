import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { coupeEtDiagrammes } from '../../app/src/dessin';
import { lireSaisie, saisieParDefaut, verifier, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';
import { appuisHtml, chargesHtml, couchesHtml, messageDErreur, verdictsHtml, voletsHtml } from '../../app/src/vue';

afterEach(() => definirLangue('fr'));

const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), 'utf8');

/** Mots francais qui ne doivent jamais sortir en anglais. */
const FRANCAIS = /\b(tableau|valeur|recommandée|gouvernant|paroi|butée|appui|combinaison|nappe|charge|couche|effort|lierne|fiche|modifié|bibliothèque|jeu)\b/i;

function saisies(): [string, Saisie][] {
  const base = saisieParDefaut();
  const toutes = saisieParDefaut();
  toutes.charges = [
    { ...toutes.charges[0] },
    { ...toutes.charges[0], type: 'bande', nature: 'permanente', rigide: false },
    { ...toutes.charges[0], type: 'force', z: '0,5' },
    { ...toutes.charges[0], type: 'moment' },
    { ...toutes.charges[0], type: 'pression', z1: '1', z2: '2' },
  ];
  toutes.appuis.push({ ...toutes.appuis[0], nom: 'A2', type: 'buton', z: '3,5', effort: '200', EA: '400000', longueur: '8', lierne: 'deux-appuis' });
  toutes.gQ = '1,6';
  toutes.forme = 'trapeze';
  toutes.couches[0].phi = '42';
  const g1 = saisieParDefaut();
  g1.generation = '1re';
  g1.profil = 'anb';
  const da2 = saisieParDefaut();
  da2.generation = '1re';
  da2.approche1 = 'DA2';
  const d = saisieParDefaut();
  d.approche2 = 'd';
  d.L = '7';
  const console = saisieParDefaut();
  console.appuis = [];
  console.degre = '100';
  console.H = '3';
  return [['base', base], ['toutes', toutes], ['ANB', g1], ['DA2', da2], ['(d) court', d], ['console', console]];
}

describe('anglais', () => {
  it('page anglaise', () => {
    const en = lire('../../app/en/index.html');
    expect(en).toContain('lang="en"');
    expect(contenuBalise(en, 'h1')).toBe('Embedded walls');
    expect(constatsAffichage(texteVisible(en), { langue: 'en' })).toEqual([]);
    expect(en).toContain('src="../src/main.ts"');
  });

  it.each(saisies())('%s : rien de francais a l ecran ni dans la note', (_n: string, s: Saisie) => {
    definirLangue('en');
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    const r = verifier(l.calcul);
    const ecran = texteVisible(verdictsHtml(l.calcul, r) + voletsHtml(r) + couchesHtml(s) + appuisHtml(s) + chargesHtml(s) +
      coupeEtDiagrammes(l.calcul, r, { q: true, V: true, M: true, w: true, cotes: true, combinaison: r.gouvernant.combinaison }));
    expect(ecran.match(new RegExp(FRANCAIS.source, "gi")) ?? []).toEqual([]);
    expect(constatsAffichage(ecran, { langue: 'en' })).toEqual([]);
    const note = texteVisible(noteDeCalculHtml(noteDuCalcul(l.calcul, r, { projet: 'P', element: '', date: '2026-11-09' })));
    expect(note.match(new RegExp(FRANCAIS.source, "gi")) ?? []).toEqual([]);
    expect(constatsAffichage(note, { langue: 'en' })).toEqual([]);
  });

  it('refus traduits', () => {
    definirLangue('en');
    const s = saisieParDefaut();
    s.H = 'x';
    const l = lireSaisie(s);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toBe('Field “Retained height H” is not a readable number (“x”).');
    const t = saisieParDefaut();
    t.L = '5';
    const lt = lireSaisie(t);
    if (!lt.ok) throw new Error(lt.message);
    let m = '';
    try {
      verifier(lt.calcul);
    } catch (e) {
      m = messageDErreur(e);
    }
    expect(m).toBe('The wall length must exceed the retained height.');
    for (const p of [(x: Saisie) => { x.couches[0].phi = '70'; }, (x: Saisie) => { x.appuis[0].z = '8'; }, (x: Saisie) => { x.appuis = []; }]) {
      const y = saisieParDefaut();
      p(y);
      const ly = lireSaisie(y);
      if (!ly.ok) throw new Error(ly.message);
      let msg = '';
      try {
        verifier(ly.calcul);
      } catch (e) {
        msg = messageDErreur(e);
      }
      expect(msg.length).toBeGreaterThan(0);
      expect(constatsAffichage(msg, { langue: 'en' })).toEqual([]);
      expect(msg).not.toMatch(FRANCAIS);
    }
  });

  it('le francais reste intact', () => {
    const s = saisieParDefaut();
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    const r = verifier(l.calcul);
    expect(texteVisible(verdictsHtml(l.calcul, r))).toContain('Résistance du terrain');
    expect(s.couches[0].nom).toBe('Remblai');
  });
});

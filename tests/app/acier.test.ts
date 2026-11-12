// Tests d'acceptation du lot acier, interface (T2) et note (T3) de PLAN.md. A ne pas modifier.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { constatsAffichage, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { lireSaisie, relire, saisieParDefaut, serialiser, verifier, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';
import { appuisHtml, hypotheses, verdictsHtml } from '../../app/src/vue';

afterEach(() => definirLangue('fr'));

const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const FRANCAIS = /\b(tableau|valeur|recommandée|paroi|butée|appui|buton|combinaison|charge|couche|effort|lierne|fiche|profilé|longueur|entraxe|aucun)\b/i;

/** Cas par defaut avec profils de berlinoise, un buton et sa lierne. */
function avecAcier(): Saisie {
  const s = saisieParDefaut();
  s.profilParoi = 'HEB 300';
  s.nuance = 'S355';
  s.entraxeProfils = '2,2';
  s.appuis = [{ ...s.appuis[0], nom: 'B1', type: 'buton', EA: '400000', longueur: '9', lierne: 'continue', profilButon: 'HEB 200', profilLierne: 'HEB 160' }];
  return s;
}

describe('T2 : saisie et ecran', () => {
  it('valeurs par defaut : rien a verifier', () => {
    const s = saisieParDefaut();
    expect(s.profilParoi).toBe('');
    expect(s.nuance).toBe('S235');
    expect(s.entraxeProfils).toBe('2,5');
    expect(s.appuis[0].profilButon).toBe('');
    expect(s.appuis[0].profilLierne).toBe('');
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    expect(l.calcul.acier).toEqual({ paroi: null, butons: [null], liernes: [null] });
  });

  it('lecture des profils, nuance commune', () => {
    const l = lireSaisie(avecAcier());
    if (!l.ok) throw new Error(l.message);
    expect(l.calcul.acier).toEqual({
      paroi: { profil: 'HEB 300', nuance: 'S355', entraxe: 2.2 },
      butons: [{ profil: 'HEB 200', nuance: 'S355' }],
      liernes: [{ profil: 'HEB 160', nuance: 'S355' }],
    });
  });

  it('refus : entraxe des profils illisible ou nul ; nuance inconnue ramenee a S235', () => {
    const s = avecAcier();
    s.entraxeProfils = '0';
    const l = lireSaisie(s);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toBe('L’entraxe des profilés doit être strictement positif.');
    s.entraxeProfils = 'x';
    expect(lireSaisie(s).ok).toBe(false);
    const n = avecAcier();
    n.nuance = 'S999';
    const ln = lireSaisie(n);
    if (!ln.ok) throw new Error(ln.message);
    expect(ln.calcul.acier.paroi?.nuance).toBe('S235');
  });

  it('enregistrement et relecture, fichiers anciens compris', () => {
    const r = relire(serialiser(avecAcier()));
    expect(r.profilParoi).toBe('HEB 300');
    expect(r.appuis[0].profilLierne).toBe('HEB 160');
    const ancien = JSON.parse(serialiser(saisieParDefaut())) as Record<string, unknown> & { appuis: Record<string, unknown>[] };
    delete ancien.profilParoi;
    delete ancien.appuis[0].profilButon;
    const v = relire(JSON.stringify(ancien));
    expect(v.profilParoi).toBe('');
    expect(v.appuis[0].profilButon).toBe('');
  });

  it('champs a l ecran : pages et liste des appuis', () => {
    for (const page of ['../../app/index.html', '../../app/en/index.html']) {
      const h = lire(page);
      for (const c of ['profilParoi', 'nuance', 'entraxeProfils']) expect(h).toContain(`data-champ="${c}"`);
      for (const n of ['S235', 'S275', 'S355', 'S420', 'S460']) expect(h).toContain(`<option value="${n}">${n}</option>`);
    }
    const a = appuisHtml(avecAcier());
    expect(a).toContain('data-sous="profilButon"');
    expect(a).toContain('data-sous="profilLierne"');
    expect(a).toContain('value="HEB 200"');
  });

  it('verdicts acier : une carte par element, taux de sections-ec3', () => {
    const l = lireSaisie(avecAcier());
    if (!l.ok) throw new Error(l.message);
    const r = verifier(l.calcul);
    const h = verdictsHtml(l.calcul, r);
    expect(h.match(/data-verification="acier"/g)).toHaveLength(3);
    expect(h.match(/data-verification="rotation"/g)).toHaveLength(r.combinaisons.length);
    const t = texteVisible(h);
    for (const m of ['Acier, EN 1993-1-1', 'Profilés de berlinoise', 'Buton B1', 'Lierne B1', 'HEB 300 S355', 'HEB 200 S355', 'HEB 160 S355', '6.2, 6.3']) {
      expect(t).toContain(m);
    }
    expect(constatsAffichage(t)).toEqual([]);
    expect(texteVisible(verdictsHtml(lireOk(saisieParDefaut()), verifier(lireOk(saisieParDefaut()))))).not.toContain('EN 1993-1-1');
  });

  it('erreurs a l ecran : profil inconnu, buton sans longueur', () => {
    const s = avecAcier();
    s.profilParoi = 'XYZ 1';
    s.appuis[0].longueur = '';
    s.appuis[0].EA = '';
    const c = lireOk(s);
    const t = texteVisible(verdictsHtml(c, verifier(c)));
    expect(t).toContain('Profilé absent du catalogue.');
    expect(t).toContain('Longueur libre du buton à renseigner.');
  });

  it('hypotheses : choix des efforts acier', () => {
    expect(hypotheses().some((h) => h.includes('0,6') && h.includes('EN 1993-1-1'))).toBe(true);
  });
});

function lireOk(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}

describe('T3 : note et anglais', () => {
  it('note : verifications et tableau acier', () => {
    const c = lireOk(avecAcier());
    const r = verifier(c);
    const n = noteDuCalcul(c, r, { projet: 'P', element: '', date: '2026-11-12' });
    const acier = n.verifications.filter((v) => v.clause === 'EN 1993-1-1, 6.2 ; 6.3');
    expect(acier.map((v) => v.nom)).toEqual(['Profilés de berlinoise, HEB 300 S355', 'Buton B1, HEB 200 S355', 'Lierne B1, HEB 160 S355']);
    for (const v of acier) {
      expect(v.taux).toBeGreaterThan(0);
      expect(v.ok).toBe(v.taux <= 1);
    }
    const texte = texteVisible(noteDeCalculHtml(n));
    expect(texte).toContain('Acier');
    expect(texte).toContain('N (kN)');
    expect(constatsAffichage(texte)).toEqual([]);
  });

  it('note : erreur signalee non conforme', () => {
    const s = avecAcier();
    s.profilParoi = 'XYZ 1';
    const c = lireOk(s);
    const v = noteDuCalcul(c, verifier(c), { projet: 'P', element: '', date: '2026-11-12' }).verifications
      .find((x) => x.nom.startsWith('Profilés de berlinoise'));
    expect(v?.ok).toBe(false);
  });

  it('anglais : ecran et note sans francais', () => {
    definirLangue('en');
    const s = avecAcier();
    const c = lireOk(s);
    const r = verifier(c);
    const ecran = texteVisible(verdictsHtml(c, r) + appuisHtml(s));
    for (const m of ['Steel, EN 1993-1-1', 'Soldier piles', 'Strut B1', 'Waler B1']) expect(ecran).toContain(m);
    expect(ecran.match(new RegExp(FRANCAIS.source, 'gi')) ?? []).toEqual([]);
    expect(constatsAffichage(ecran, { langue: 'en' })).toEqual([]);
    const note = texteVisible(noteDeCalculHtml(noteDuCalcul(c, r, { projet: 'P', element: '', date: '2026-11-12' })));
    expect(note).toContain('Soldier piles, HEB 300 S355');
    expect(note.match(new RegExp(FRANCAIS.source, 'gi')) ?? []).toEqual([]);
    expect(constatsAffichage(note, { langue: 'en' })).toEqual([]);
    const e = avecAcier();
    e.profilParoi = 'XYZ 1';
    e.appuis[0].longueur = '';
    e.appuis[0].EA = '';
    const ce = lireOk(e);
    const te = texteVisible(verdictsHtml(ce, verifier(ce)));
    expect(te).toContain('Section not in the catalogue.');
    expect(te).toContain('Free length of the strut required.');
  });
});

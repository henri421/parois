// Tests d'acceptation du lot fond, interface et note (T2 de PLAN.md, lot fond). A ne pas modifier.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { constatsAffichage, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { lireSaisie, relire, saisieParDefaut, serialiser, verifier, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';
import { hypotheses, verdictsHtml } from '../../app/src/vue';

afterEach(() => definirLangue('fr'));

const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const FRANCAIS = /\b(tableau|valeur|paroi|appui|combinaison|charge|couche|effort|fiche|soulèvement|fouille|poussée|poids|largeur|longueur|drainé|vers|outil)\b/i;

function lireOk(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}

/** Fouille dans une argile molle sous un remblai, largeur saisie. */
function argile(): Saisie {
  const s = saisieParDefaut();
  s.couches = [{ ...s.couches[0], h: '2' }, { ...s.couches[1], nom: 'Argile', h: '30', phi: '0', c: '40' }];
  s.zTerre = '40';
  s.zFouille = '40';
  s.ecoulement = false;
  s.L = '14';
  s.largeurFouille = '10';
  s.poidsParoi = '30';
  return s;
}

describe('saisie', () => {
  it('valeurs par defaut et lecture', () => {
    const s = saisieParDefaut();
    expect([s.largeurFouille, s.longueurFouille, s.poidsParoi]).toEqual(['', '', '']);
    const c = lireOk(s);
    expect(c.donnees.fouille).toEqual({ B: null, longueur: null });
    expect(c.donnees.poidsParoi).toBe(0);
    const a = argile();
    a.longueurFouille = '25';
    const ca = lireOk(a);
    expect(ca.donnees.fouille).toEqual({ B: 10, longueur: 25 });
    expect(ca.donnees.poidsParoi).toBe(30);
  });

  it('refus', () => {
    for (const [champ, v, m] of [
      ['largeurFouille', '0', 'La largeur de fouille doit être strictement positive.'],
      ['longueurFouille', '-2', 'La longueur de fouille doit être strictement positive.'],
      ['poidsParoi', '-1', 'Le poids de la paroi ne peut pas être négatif.'],
    ] as const) {
      const s = saisieParDefaut();
      s[champ] = v;
      const l = lireSaisie(s);
      expect(l.ok).toBe(false);
      if (!l.ok) expect(l.message).toBe(m);
    }
  });

  it('relecture, fichiers anciens compris', () => {
    expect(relire(serialiser(argile())).largeurFouille).toBe('10');
    const ancien = JSON.parse(serialiser(saisieParDefaut())) as Record<string, unknown>;
    delete ancien.largeurFouille;
    delete ancien.poidsParoi;
    const v = relire(JSON.stringify(ancien));
    expect([v.largeurFouille, v.poidsParoi]).toEqual(['', '']);
  });

  it('champs des pages', () => {
    for (const page of ['../../app/index.html', '../../app/en/index.html']) {
      const h = lire(page);
      for (const c of ['largeurFouille', 'longueurFouille', 'poidsParoi']) expect(h).toContain(`data-champ="${c}"`);
    }
  });
});

describe('verdicts', () => {
  it('cas par defaut (ecoulement, sable) : HYD et equilibre vertical, pas de soulevement du fond', () => {
    const c = lireOk(saisieParDefaut());
    const r = verifier(c);
    const h = verdictsHtml(c, r);
    expect(h.match(/data-verification="hyd"/g)).toHaveLength(1);
    expect(h.match(/data-verification="vertical"/g)).toHaveLength(r.combinaisons.length);
    expect(h).not.toContain('data-verification="fond"');
    const t = texteVisible(h);
    for (const m of ['Fond de fouille et équilibre vertical', 'Soulèvement hydraulique', 'EN 1997-1:2024, 8.1.4.2', 'Équilibre vertical', '7.6.4, D.12']) {
      expect(t).toContain(m);
    }
    expect(constatsAffichage(t)).toEqual([]);
  });

  it('argile : une carte de soulevement du fond par combinaison', () => {
    const c = lireOk(argile());
    const r = verifier(c);
    const h = verdictsHtml(c, r);
    expect(h.match(/data-verification="fond"/g)).toHaveLength(r.combinaisons.length);
    expect(h).not.toContain('data-verification="hyd"');
    const t = texteVisible(h);
    expect(t).toContain('Soulèvement du fond');
    expect(t).toContain('7.6.6, D.24');
  });

  it('argile sans largeur : constat', () => {
    const s = argile();
    s.largeurFouille = '';
    const c = lireOk(s);
    expect(texteVisible(verdictsHtml(c, verifier(c)))).toContain('Largeur de fouille non saisie : soulèvement du fond non vérifié.');
  });

  it('1re generation : clauses de 2004', () => {
    const s = saisieParDefaut();
    s.generation = '1re';
    const c = lireOk(s);
    const t = texteVisible(verdictsHtml(c, verifier(c)));
    expect(t).toContain('EN 1997-1:2004, 2.4.7.5');
    expect(t).toContain('9.7.5');
  });

  it('hypotheses', () => {
    const h = hypotheses().join(' ');
    expect(h).toContain('Bjerrum');
    expect(h).toContain('D.12');
    expect(h).toContain('0,67');
  });
});

describe('note et anglais', () => {
  it('note : verifications du fond et de l equilibre vertical', () => {
    const c = lireOk(argile());
    const r = verifier(c);
    const n = noteDuCalcul(c, r, { projet: 'P', element: '', date: '2026-11-13' });
    const noms = n.verifications.map((v) => v.nom);
    expect(noms.filter((x) => x.startsWith('Soulèvement du fond'))).toHaveLength(r.combinaisons.length);
    expect(noms.filter((x) => x.startsWith('Équilibre vertical'))).toHaveLength(r.combinaisons.length);
    const d = lireOk(saisieParDefaut());
    const nd = noteDuCalcul(d, verifier(d), { projet: 'P', element: '', date: '2026-11-13' });
    expect(nd.verifications.filter((v) => v.nom === 'Soulèvement hydraulique')).toHaveLength(1);
    expect(constatsAffichage(texteVisible(noteDeCalculHtml(n)))).toEqual([]);
  });

  it('anglais : ecran et note sans francais', () => {
    definirLangue('en');
    for (const s of [saisieParDefaut(), argile(), (() => { const x = argile(); x.largeurFouille = ''; return x; })()]) {
      const c = lireOk(s);
      const r = verifier(c);
      const ecran = texteVisible(verdictsHtml(c, r));
      expect(ecran.match(new RegExp(FRANCAIS.source, 'gi')) ?? []).toEqual([]);
      expect(constatsAffichage(ecran, { langue: 'en' })).toEqual([]);
      const note = texteVisible(noteDeCalculHtml(noteDuCalcul(c, r, { projet: 'P', element: '', date: '2026-11-13' })));
      expect(note.match(new RegExp(FRANCAIS.source, 'gi')) ?? []).toEqual([]);
      expect(constatsAffichage(note, { langue: 'en' })).toEqual([]);
    }
    const c = lireOk(saisieParDefaut());
    const t = texteVisible(verdictsHtml(c, verifier(c)));
    for (const m of ['Excavation base and vertical equilibrium', 'Hydraulic heave', 'Vertical equilibrium']) expect(t).toContain(m);
  });
});

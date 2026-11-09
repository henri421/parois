import { describe, expect, it } from 'vitest';
import { coupeEtDiagrammes } from '../../app/src/dessin';
import { lireSaisie, longueurProposee, relire, saisieParDefaut, serialiser, verifier, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';

function calcul(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}

describe('saisie', () => {
  it('cas par defaut lu et calcule', () => {
    const c = calcul(saisieParDefaut());
    expect(c.donnees.couches[0].kDeltaA).toBeCloseTo(2 / 3, 9);
    expect(c.donnees.eau.zTerre).toBe(2.5);
    const r = verifier(c);
    expect(r.gouvernant.combinaison).toBe('(b)');
    expect(r.gouvernant.mobilisation).toBeGreaterThan(0.5);
    expect(r.gouvernant.mobilisation).toBeLessThan(1);
  });
  it('refus nomme le champ', () => {
    const s = saisieParDefaut();
    s.couches[1].phi = 'x';
    const l = lireSaisie(s);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toContain('Limon argileux');
  });
  it('champs optionnels et generations', () => {
    const s = saisieParDefaut();
    s.gQ = '1,8';
    s.appuis[0].effort = '';
    s.generation = '1re';
    s.approche1 = 'DA2';
    const c = calcul(s);
    expect(c.donnees.modifications).toEqual({ gQ: 1.8 });
    expect(c.donnees.appuis[0].effortImpose).toBe(null);
    expect(verifier(c).combinaisons[0].nom).toBe('DA2');
  });
  it('aller-retour du fichier', () => {
    const s = saisieParDefaut();
    s.H = '5,5';
    s.appuis.push({ ...s.appuis[0], nom: 'A2', z: '3' });
    expect(relire(serialiser(s))).toEqual(s);
    expect(() => relire('{"format":"autre"}')).toThrow(/Format/);
  });
  it('longueur proposee retablit l equilibre', () => {
    const s = saisieParDefaut();
    const c = calcul(s);
    const L = longueurProposee(c, verifier(c));
    expect(L).not.toBe(null);
    s.L = L as string;
    const c2 = calcul(s);
    const m = verifier(c2).gouvernant.mobilisation;
    expect(m).toBeLessThanOrEqual(1);
    expect(m).toBeGreaterThan(0.95);
  });
});

describe('sorties', () => {
  const c = calcul(saisieParDefaut());
  const r = verifier(c);
  it('dessin : quatre diagrammes, sans valeur non finie', () => {
    const svg = coupeEtDiagrammes(c, r, { q: true, V: true, M: true, w: true, cotes: true, combinaison: '(b)' });
    for (const t of ['Charge équivalente q', 'Effort tranchant V', 'Moment M', 'Déplacement w', 'Remblai']) expect(svg).toContain(t);
    expect(svg).not.toContain('NaN');
  });
  it('dessin : diagramme masque', () => {
    expect(coupeEtDiagrammes(c, r, { q: false, V: true, M: true, w: true, cotes: false, combinaison: '(a)' })).not.toContain('Charge équivalente');
  });
  it('note : chaque combinaison verifiee, sections remplies', () => {
    const n = noteDuCalcul(c, r, { projet: 'P', element: '', date: '2026-11-09' });
    expect(n.verifications.length).toBe(2);
    expect(n.sections.geometrie!.length).toBeGreaterThan(1);
    expect(n.sections.calculs!.length).toBeGreaterThan(2);
    expect(n.cartouche.outil).toBe('parois');
    expect(n.avertissements!.length).toBeGreaterThan(0);
  });
});

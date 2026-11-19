// Tests d'acceptation du phasage cote application (PLAN-phasage.md, T2 a T4). Ecrits par Claude
// le 20/11/2026. Purs (aucun jsdom). A ne pas modifier.
import { describe, expect, it } from 'vitest';
import { coupeEtDiagrammes, dessinPhasage } from '../../app/src/dessin';
import { lireSaisie, phasesGenerees, relire, saisieParDefaut, serialiser, verifier, verifierPhasage, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';
import { verifierPhases } from '../../src/phases';

function calcul(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}

/** Cas par defaut (H = 6 m, A1 a 1,2 m) avec un second tirant A2 a 3,5 m et le phasage actif. */
function phasee(): Saisie {
  const s = saisieParDefaut();
  s.appuis.push({ ...s.appuis[0], nom: 'A2', z: '3,5' });
  s.phasage = true;
  s.phases = phasesGenerees(s);
  return s;
}

const cartouche = { projet: 'P', element: 'E', date: '2026-11-20' };

describe('T2 saisie des phases', () => {
  it('par defaut : phasage inactif, surexcavation 0,5 m, aucune phase ; le calcul ne change pas', () => {
    const s = saisieParDefaut();
    expect(s.phasage).toBe(false);
    expect(s.surexcavation).toBe('0,5');
    expect(s.phases).toEqual([]);
    const c = calcul(s);
    expect(c.phases).toBe(null);
    expect(verifierPhasage(c)).toBe(null);
  });
  it('generation : phases intermediaires seulement (la finale est implicite), nombres a la francaise', () => {
    const s = saisieParDefaut();
    s.appuis.push({ ...s.appuis[0], nom: 'A2', z: '3,5' });
    expect(phasesGenerees(s)).toEqual([
      { H: '1,7', appuis: [], zEau: '2,5' },
      { H: '4', appuis: ['A1'], zEau: '4' },
    ]);
    s.surexcavation = '1';
    expect(phasesGenerees(s).map((p) => p.H)).toEqual(['2,2', '4,5']);
  });
  it('lecture : phases nommees, finale ajoutee avec H, tous les appuis et l eau de la saisie', () => {
    const c = calcul(phasee());
    expect(c.phases).toEqual([
      { nom: 'Phase 1', H: 1.7, appuis: [], zEau: 2.5 },
      { nom: 'Phase 2', H: 4, appuis: ['A1'], zEau: 4 },
      { nom: 'Phase 3', H: 6, appuis: ['A1', 'A2'], zEau: 6.5 },
    ]);
  });
  it('refus nomme la phase et le champ', () => {
    const s = phasee();
    s.phases[1].H = 'x';
    const l = lireSaisie(s);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toContain('Phase 2');
  });
  it('fichier : aller-retour avec phases ; un fichier ancien se relit sans phasage', () => {
    const s = phasee();
    expect(relire(serialiser(s))).toEqual(s);
    const ancien = JSON.parse(serialiser(saisieParDefaut())) as Record<string, unknown>;
    delete ancien.phasage;
    delete ancien.surexcavation;
    delete ancien.phases;
    const r = relire(JSON.stringify(ancien));
    expect(r.phasage).toBe(false);
    expect(r.phases).toEqual([]);
  });
  it('verifierPhasage = verifierPhases du noyau ; verifier reste le calcul final', () => {
    const c = calcul(phasee());
    const rp = verifierPhasage(c)!;
    expect(rp.determinante).toEqual(verifierPhases(c.donnees, c.phases!).determinante);
    expect(verifier(c).gouvernant).toEqual(rp.phases[2].resultat.gouvernant);
  });
});

describe('T3 note de calcul phasee', () => {
  const c = calcul(phasee());
  const r = verifier(c);
  const n = noteDuCalcul(c, r, cartouche);
  const texte = JSON.stringify(n);

  it('hypothese du phasage et tableau des phases', () => {
    expect(texte).toContain('sans historique');
    expect(texte).toMatch(/"titre":"Phases[^"]*"/);
  });
  it('conclusions : chaque verification de chaque phase, prefixee par la phase', () => {
    for (const p of ['Phase 1', 'Phase 2', 'Phase 3']) {
      expect(n.verifications.some((v) => v.nom.startsWith(`${p} · `))).toBe(true);
    }
    const rp = verifierPhasage(c)!;
    // 20/11/2026, Claude (conception) : la phase determinante est definie par la mobilisation de la
    // butee ; on la cherche donc parmi les verifications de rotation. L'equilibre vertical de la
    // phase en console (Phase 1) depasse ici celui de la phase finale et ne doit pas etre masque.
    const det = n.verifications.filter((v) => v.nom.includes('Rotation'))
      .reduce((a, b) => ((b.taux ?? -1) > (a.taux ?? -1) ? b : a));
    expect(det.nom.startsWith(`${rp.determinante.phase} · `)).toBe(true);
  });
  it('enveloppe dans les calculs : longueur requise et effort maximal de chaque appui avec sa phase', () => {
    expect(texte).toContain('Enveloppe');
    expect(texte).toContain('A1');
    expect(texte).toContain('A2');
  });
  it('sans phasage, la note est celle d aujourd hui', () => {
    const s = saisieParDefaut();
    const c0 = calcul(s);
    expect(JSON.stringify(noteDuCalcul(c0, verifier(c0), cartouche))).not.toContain('Phase 1');
  });
});

describe('T4 dessin phase', () => {
  const c = calcul(phasee());
  const rp = verifierPhasage(c)!;
  const o = { q: true, V: true, M: true, w: false, cotes: true, combinaison: rp.determinante.combinaison };

  it('enveloppe : zone des moments et fonds de fouille successifs', () => {
    const svg = dessinPhasage(c, rp, 'enveloppe', o);
    expect(svg).toContain('data-role="enveloppe"');
    for (let i = 1; i <= 3; i++) expect(svg).toContain(`data-phase="${i}"`);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it('une phase : le dessin ordinaire de cette phase', () => {
    const svg = dessinPhasage(c, rp, 1, o);
    expect(svg).not.toContain('data-role="enveloppe"');
    expect(svg).not.toMatch(/NaN|Infinity/);
    const final = dessinPhasage(c, rp, 2, o);
    expect(final).toBe(coupeEtDiagrammes(c, verifier(c), o));
  });
});

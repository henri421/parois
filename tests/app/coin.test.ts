import { afterEach, describe, expect, it } from 'vitest';
import { constatsAffichage, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { lireSaisie, relire, saisieParDefaut, serialiser, verifier } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';
import { chargesHtml } from '../../app/src/vue';

afterEach(() => definirLangue('fr'));

const avecBande = (modele: string | undefined, rigide: boolean) => {
  const s = saisieParDefaut();
  s.charges = [{ ...s.charges[0], type: 'bande', nature: 'permanente', rigide, modele }];
  return s;
};

describe('bande en coin de poussee', () => {
  it('lecture du modele, fichiers anciens compris', () => {
    const lit = (m: string | undefined, r: boolean) => {
      const l = lireSaisie(avecBande(m, r));
      if (!l.ok) throw new Error(l.message);
      return l.calcul.donnees.charges[0];
    };
    expect(lit('coin', true)).toMatchObject({ modele: 'coin' });
    expect(lit(undefined, false)).toMatchObject({ modele: 'boussinesq', rigide: false });
    expect(lit(undefined, true)).toMatchObject({ modele: 'boussinesq', rigide: true });
    expect(lit('souple', true)).toMatchObject({ modele: 'boussinesq', rigide: false });
  });

  it('enregistrement et relecture', () => {
    expect(relire(serialiser(avecBande('coin', true))).charges[0].modele).toBe('coin');
    const ancien = JSON.parse(serialiser(avecBande(undefined, false))) as { charges: Record<string, unknown>[] };
    delete ancien.charges[0].modele;
    const l = lireSaisie(relire(JSON.stringify(ancien)));
    if (!l.ok) throw new Error(l.message);
    expect(l.calcul.donnees.charges[0]).toMatchObject({ modele: 'boussinesq', rigide: false });
  });

  it('ecran et note, en francais et en anglais', () => {
    for (const langue of ['fr', 'en'] as const) {
      definirLangue(langue);
      const s = avecBande('coin', true);
      const l = lireSaisie(s);
      if (!l.ok) throw new Error(l.message);
      const ecran = texteVisible(chargesHtml(s));
      expect(ecran).toContain(langue === 'fr' ? 'Coin de poussée' : 'Earth-pressure wedge');
      const note = texteVisible(noteDeCalculHtml(noteDuCalcul(l.calcul, verifier(l.calcul), { projet: 'P', element: '', date: '2026-11-10' })));
      expect(note).toContain(langue === 'fr' ? 'coin de poussée' : 'earth-pressure wedge');
      expect(constatsAffichage(note, { langue })).toEqual([]);
    }
  });
});

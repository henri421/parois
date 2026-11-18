// Lot E (audit R4) : profil luxembourgeois de la 1re generation (valeurs recommandees presumees, sources AN-LU).
import { describe, expect, it } from 'vitest';
import { definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { profil1g } from 'sol-ec7';
import { buteeReLu, profilLu1g } from '../../app/src/annexe';
import { lireSaisie, relire, saisieParDefaut, serialiser, verifier, type Saisie } from '../../app/src/form';
import { noteDuCalcul } from '../../app/src/note';

function calcul(s: Saisie) {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.calcul;
}

const lu = (approche1 = 'DA2'): Saisie => ({ ...saisieParDefaut(), generation: '1re', profil: 'lu', approche1 });

describe('annexe luxembourgeoise (parois)', () => {
  it('memes valeurs que le profil recommande, sources ILNAS-EN 1997-1/AN-LU:2020', () => {
    expect(profilLu1g().M2.gPhi.valeur).toBe(profil1g().M2.gPhi.valeur);
    expect(profilLu1g().M2.gPhi.source).toMatch(/^ILNAS-EN 1997-1\/AN-LU:2020, tableau A\.4 : valeur recommandée présumée retenue/);
    expect(buteeReLu().R2).toEqual({ valeur: 1.4, source: expect.stringMatching(/^ILNAS-EN 1997-1\/AN-LU:2020, tableau A\.13 : valeur recommandée présumée retenue/) });
  });

  it('memes resultats que les valeurs recommandees, coefficients sources AN-LU', () => {
    const rLu = verifier(calcul(lu()));
    const rRec = verifier(calcul({ ...lu(), profil: 'recommande' }));
    expect(rLu.gouvernant.mobilisation).toBeCloseTo(rRec.gouvernant.mobilisation, 12);
    const gRe = rLu.combinaisons[0].coefficients.find((k) => k.nom === 'γ_Re');
    expect(gRe?.valeur).toBe(1.4);
    expect(gRe?.source).toMatch(/AN-LU:2020, tableau A\.13/);
    expect(rLu.combinaisons[0].coefficients.find((k) => k.nom === 'γ_G')?.source).toMatch(/AN-LU:2020/);
    // Sans annexe : la source du A.13 reste celle de la norme.
    expect(rRec.combinaisons[0].coefficients.find((k) => k.nom === 'γ_Re')?.source).toBe('EN 1997-1:2004, tableau A.13, valeur recommandée');
  });

  it('choix enregistre et relu ; note : norme AN-LU, avertissement en tete, sources visibles', () => {
    expect(relire(serialiser(lu())).profil).toBe('lu');
    const c = calcul(lu());
    const note = noteDuCalcul(c, verifier(c), { projet: 'P', element: 'E', date: '2026-11-19' });
    expect(note.cartouche.norme).toContain('ILNAS-EN 1997-1/AN-LU:2020');
    expect(note.avertissements?.[0]).toMatch(/^Annexe nationale luxembourgeoise/);
    // parois laisse modifier chaque coefficient : l'avertissement complet est juste.
    expect(note.avertissements?.[0]).toMatch(/vous pouvez modifier chacune/);
    expect(texteVisible(noteDeCalculHtml(note, ''))).toContain('AN-LU:2020');
  });

  it('valeurs recommandees : ni norme AN-LU ni avertissement', () => {
    const c = calcul({ ...lu(), profil: 'recommande' });
    const note = noteDuCalcul(c, verifier(c), { projet: 'P', element: 'E', date: '2026-11-19' });
    expect(note.cartouche.norme).toBe('EN 1997-1:2004');
    expect(note.avertissements?.some((a) => /luxembourgeoise/.test(a))).toBe(false);
  });

  it('anglais : sources et avertissement traduits', () => {
    definirLangue('en');
    try {
      const c = calcul(lu());
      const note = noteDuCalcul(c, verifier(c), { projet: 'P', element: 'E', date: '2026-11-19' });
      const texte = texteVisible(noteDeCalculHtml(note, ''));
      expect(texte).toContain('Luxembourg National Annex');
      expect(texte).toContain('recommended value presumed retained');
      expect(texte).not.toMatch(/présumée|non vérifiée/);
    } finally {
      definirLangue('fr');
    }
  });

  it('pages : option Luxembourg, bandeau, approche visible aussi pour lu', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['app/index.html', 'app/en/index.html']) {
      const html = readFileSync(f, 'utf8');
      expect(html).toContain('<option value="lu">Luxembourg (AN-LU:2020');
      expect(html).toContain('data-role="bandeau-annexe"');
      expect(html).toContain('data-si-profil="recommande lu"');
    }
  });
});

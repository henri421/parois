/**
 * Annexe nationale luxembourgeoise (lot E, audit R4). Module PUR.
 *
 * Profil 1re generation construit a partir du profil recommande de sol-ec7 et de la table
 * commune `AN_LU` d'aedificium-ui : chaque coefficient porte sa source ILNAS, presumee tant
 * que l'annexe n'est pas lue. Les γ_R;e de la butee (tableau A.13) suivent le meme
 * traitement. L'annexe luxembourgeoise ne couvre pas la 2e generation.
 */

import { valeurLu } from 'aedificium-ui';
import { clauseDeSource, profil1g, reetiqueter1g, type Profil1g, type ValeurSourcee } from 'sol-ec7';
import { BUTEE_RE_RECOMMANDEE } from '../../src/parois';

export function profilLu1g(): Profil1g {
  return reetiqueter1g(
    profil1g(),
    'Luxembourg, ILNAS-EN 1997-1/AN-LU:2020 (valeurs présumées, à vérifier)',
    '2026-11-19',
    (v, chemin) => valeurLu('EN 1997-1', chemin, v, clauseDeSource(v.source)),
  );
}

export function buteeReLu(): { R1: ValeurSourcee; R2: ValeurSourcee; R3: ValeurSourcee } {
  const r = BUTEE_RE_RECOMMANDEE;
  return {
    R1: valeurLu('EN 1997-1', 'Re_butee.R1', r.R1, 'tableau A.13'),
    R2: valeurLu('EN 1997-1', 'Re_butee.R2', r.R2, 'tableau A.13'),
    R3: valeurLu('EN 1997-1', 'Re_butee.R3', r.R3, 'tableau A.13'),
  };
}

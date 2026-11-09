"""Attendus independants du noyau parois : integration numerique directe et methode des forces.
Aucun element fini, aucun code de l'outil. Sort tests/attendus.json."""
import json, math
import numpy as np

GW = 10.0
SABLE = [('Remblai', 3.0, 18, 20, 30, 0), ('Limon', 4.0, 19, 20, 26, 5), ('Sable', 30.0, 19, 21, 35, 0)]
EI = 125000.0
KD = 2 / 3


def kq(phi, d, actif):
    w = math.asin(math.sin(d) / math.sin(phi))
    if actif:
        return (math.cos(d) - math.sin(phi) * math.cos(w)) / (1 + math.sin(phi)) * math.exp(-(w - d) * math.tan(phi))
    return (math.cos(d) + math.sin(phi) * math.cos(w)) / (1 - math.sin(phi)) * math.exp(-(w + d) * math.tan(phi))


def champs(c, L_struct, L, j, dz=0.002):
    """Valeurs au milieu des cellules : A (actions) et B (butee pour phi = 1, signe negatif)."""
    n = int(round(L_struct / dz))
    dz = L_struct / n
    z = (np.arange(n) + 0.5) * dz
    A = np.zeros(n)
    B = np.zeros(n)
    H, zwa, zwp = c['H'], c['zwa'], c['zwp']
    i = 0.0
    if c['ecoulement'] and zwp > zwa:
        i = (zwp - zwa) / ((L - zwa) + (L - zwp))
    sa = sp = 0.0
    sp = max(0.0, H - zwp) * GW
    couches = c['couches']
    tops = np.cumsum([0] + [x[1] for x in couches])
    EG = np.zeros(n)
    EQ = np.zeros(n)
    W = np.zeros(n)
    # contraintes integrees par pas fin : on avance d'une demi-cellule au milieu
    for k in range(n):
        zm = z[k]
        ic = min(int(np.searchsorted(tops, zm, side='right')) - 1, len(couches) - 1)
        _, _, g, gs, phik, ck = couches[ic]
        pa = g if zm < zwa else gs
        sa_m = sa + pa * dz / 2
        ua = GW * max(0, zm - zwa) * (1 - i)
        up = GW * max(0, zm - zwp) * (1 + i)
        s1 = sa_m - ua
        if phik > 0:
            pd = math.atan(math.tan(math.radians(phik)) / j['gphi'])
            cd = ck / j['gc']
            d = math.atan(c.get('kd', KD) * math.tan(pd))
            K = kq(pd, d, True)
            Kc = (1 / math.cos(d) - K) / math.tan(pd)
            f = lambda q: max((K * (s1 + q) - Kc * cd) * math.cos(d), 0.1 * (s1 + q))
        else:
            x = c.get('kd', KD)
            Kc = 1 + math.asin(x) + math.cos(math.asin(x))
            cd = ck / j['gcu']
            f = lambda q: max(s1 + q - Kc * cd, 0.1 * (sa_m + q) - ua)
        m = c.get('partK0', 0)
        K0 = 1 - math.sin(pd) if phik > 0 else 1
        h = lambda q: (1 - m) * f(q) + m * K0 * (s1 + q)
        EG[k] = h(c['qG'])
        EQ[k] = h(c['qG'] + c['qQ']) - EG[k]
        W[k] = ua - up
        if zm >= H:
            pp = g if zm < zwp else gs
            sp_m = sp + pp * dz / 2
            s2 = max(0, sp_m - up)
            if phik > 0:
                Kp = kq(pd, -d, False)
                Kpc = (Kp - 1 / math.cos(d)) / math.tan(pd)
                B[k] = -(Kp * s2 + Kpc * cd) * math.cos(d) / j['gre']
            else:
                B[k] = -(s2 + Kc * cd) / j['gre']
            sp += pp * dz
        sa += pa * dz
    if c.get('rect'):
        idx = z < H
        for E in (EG, EQ):
            E[idx] = E[idx].sum() * dz / H
    A = j['gg'] * (EG + W) + j['gq'] * EQ
    return z, dz, A, B


def resoudre(c, j, L=None, g=0):
    L = c['L'] if L is None else L
    Ls = c['H'] + (L - c['H']) / 1.2 if g == 1 else L
    z, dz, A, B = champs(c, Ls, L, j)
    n = len(z)
    ap = c['appuis']
    # bases : charge A, charge B, reactions unitaires (force -1 vers le sol sur z >= zj)
    def poutre(q, sauts):
        V = np.zeros(n + 1)
        for k in range(n):
            V[k + 1] = V[k] + q[k] * dz
        ze = np.arange(n + 1) * dz
        for zj, F in sauts:
            V[ze > zj + 1e-9] += F
        M = np.zeros(n + 1)
        M[1:] = np.cumsum((V[:-1] + V[1:]) / 2) * dz
        T = np.zeros(n + 1)
        T[1:] = np.cumsum((M[:-1] + M[1:]) / 2) * dz / EI
        W_ = np.zeros(n + 1)
        W_[1:] = np.cumsum((T[:-1] + T[1:]) / 2) * dz
        return ze, V, M, W_
    imposes = [(a[0], -a[1]) for a in c.get('imposes', [])]
    ze, V0, M0, W0 = poutre(A, imposes)
    _, VB, MB, WB = poutre(B, [])
    uni = [poutre(np.zeros(n), [(zj, -1.0)]) for zj in ap]
    if not ap:
        phi = -M0[-1] / MB[-1]
        return dict(phi=phi, ze=ze, V=V0 + phi * VB, M=M0 + phi * MB, R=[], w=None)
    idx = [int(np.argmin(abs(ze - zj))) for zj in ap]
    m = len(ap)
    # inconnues : R1..Rm, phi, C1, C2
    S = np.zeros((m + 3, m + 3))
    b = np.zeros(m + 3)
    S[0, :m] = [u[1][-1] for u in uni]; S[0, m] = VB[-1]; b[0] = -V0[-1]
    S[1, :m] = [u[2][-1] for u in uni]; S[1, m] = MB[-1]; b[1] = -M0[-1]
    for r, ip in enumerate(list(idx) + [n]):
        S[2 + r, :m] = [u[3][ip] for u in uni]
        S[2 + r, m] = WB[ip]
        S[2 + r, m + 1] = 1
        S[2 + r, m + 2] = ze[ip]
        b[2 + r] = -W0[ip]
    x = np.linalg.solve(S, b)
    R, phi, C1, C2 = x[:m], x[m], x[m + 1], x[m + 2]
    V = V0 + phi * VB + sum(R[k] * uni[k][1] for k in range(m))
    M = M0 + phi * MB + sum(R[k] * uni[k][2] for k in range(m))
    w = W0 + phi * WB + sum(R[k] * uni[k][3] for k in range(m)) + C1 + C2 * ze
    return dict(phi=phi, ze=ze, V=V, M=M, R=list(R), w=w)


def dmin(c, j, g=0):
    b, h = c['H'] + 0.05, c['H'] + 40
    for _ in range(40):
        m = (b + h) / 2
        if resoudre(c, j, m, g)['phi'] > 1:
            b = m
        else:
            h = m
    return (b + h) / 2 - c['H']


BASE = dict(H=6.0, L=10.0, couches=SABLE, zwa=2.5, zwp=6.5, ecoulement=True, qG=0.0, qQ=10.0, appuis=[1.2])
JB = dict(gg=1.0, gq=1.3, gphi=1.25, gc=1.25, gcu=1.4, gre=1.0)
JA = dict(gg=1.0, gq=1.5 / 1.35, gphi=1.0, gc=1.0, gcu=1.0, gre=1.0)
JD = dict(gg=1.35, gq=1.5, gphi=1.0, gc=1.0, gcu=1.0, gre=1.4)
JS = dict(gg=1.0, gq=1.0, gphi=1.0, gc=1.0, gcu=1.0, gre=1.0)


def res(r, f=1.0):
    return dict(phi=r['phi'], M=f * float(np.max(np.abs(r['M']))), V=f * float(np.max(np.abs(r['V']))), R=[f * x for x in r['R']])


s = resoudre(BASE, JS)
sortie = {
    'kq': dict(a=kq(math.radians(30), math.radians(20), True), p=kq(math.radians(30), math.radians(-20), False)),
    'b': {**res(resoudre(BASE, JB)), 'dmin': dmin(BASE, JB)},
    'a': res(resoudre(BASE, JA), 1.35),
    'd': res(resoudre(BASE, JD)),
    'service': dict(wmax=float(s['w'][np.argmax(np.abs(s['w']))]) * 1000, wtete=float(s['w'][0]) * 1000),
}
deux = dict(BASE, appuis=[1.2, 3.8], L=9.5)
sortie['deux'] = res(resoudre(deux, JB))
impose = dict(BASE, appuis=[3.8], L=9.5, imposes=[(1.2, 100.0)])
sortie['impose'] = res(resoudre(impose, JB))
cons = dict(BASE, H=3.0, L=8.0, appuis=[], zwa=20.0, zwp=20.0, ecoulement=False)
rc = resoudre(cons, JB, g=1)
sortie['console'] = dict(phi=rc['phi'], M=float(np.max(np.abs(rc['M']))), dmin=dmin(cons, JB, 1))
sortie['rect'] = res(resoudre(dict(BASE, rect=True), JB))
sortie['k0'] = res(resoudre(dict(BASE, partK0=0.5), JB))
arg = dict(BASE, couches=[('Argile', 40.0, 19, 19, 0, 60)], zwa=50.0, zwp=50.0, ecoulement=False, L=9.0, kd=0.5)
sortie['argile'] = res(resoudre(arg, dict(JS)))
json.dump(sortie, open('tests/attendus.json', 'w'), indent=1)
print(json.dumps(sortie, indent=0)[:1800])

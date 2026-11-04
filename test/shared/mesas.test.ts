import { asignarRoles, ErrorReparto, repartirMesas, rolesParaTamano, ubicarTarde, type Reparto } from '../../src/shared/mesas.js';
import type { Rol } from '../../src/shared/valores.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const tamanos = (r: Reparto) => r.mesas.map((m) => m.ids.length);

describe('repartirMesas', () => {
  it('con 40 personas quedan cuatro mesas de siete y dos de seis', () => {
    const r = repartirMesas(ids(40));
    expect(tamanos(r)).toEqual([6, 6, 7, 7, 7, 7]);
    expect(r.mesas[2].carmen).toBe('p37');
    expect(r.mesas[0].carmen).toBeNull();
  });

  it('con 35 quedan cinco mesas de siete', () => {
    expect(tamanos(repartirMesas(ids(35)))).toEqual([7, 7, 7, 7, 7]);
  });

  it('con 29 quedan cuatro de seis y una de cinco', () => {
    expect(tamanos(repartirMesas(ids(29)))).toEqual([6, 6, 6, 6, 5]);
  });

  it('con 16 la mesa 2 cede a su último integrante', () => {
    const r = repartirMesas(ids(16));
    expect(tamanos(r)).toEqual([6, 5, 5]);
    expect(r.mesas[2].ids).toContain('p12');
  });

  it('con 10 y con 22 se arman mesas de cinco', () => {
    expect(tamanos(repartirMesas(ids(10)))).toEqual([5, 5]);
    expect(tamanos(repartirMesas(ids(22)))).toEqual([6, 6, 5, 5]);
  });

  it('con 9 queda una mesa de siete y dos espectadores', () => {
    const r = repartirMesas(ids(9));
    expect(tamanos(r)).toEqual([7]);
    expect(r.espectadores).toEqual(['p8', 'p9']);
    expect(r.mesas[0].carmen).toBe('p7');
  });

  it('con menos de 5 no se puede cerrar la inscripción', () => {
    expect(() => repartirMesas(ids(4))).toThrow(ErrorReparto);
    expect(() => repartirMesas(ids(4))).toThrow('Se necesitan al menos 5 personas para cerrar la inscripción');
  });

  it('para todo n de 5 a 45 cada id aparece una sola vez y los tamaños son 5, 6 o 7', () => {
    for (let n = 5; n <= 45; n++) {
      const r = repartirMesas(ids(n));
      const todos = [...r.mesas.flatMap((m) => m.ids), ...r.espectadores];
      expect(todos.sort()).toEqual(ids(n).sort());
      expect(r.mesas.every((m) => [5, 6, 7].includes(m.ids.length)), `n=${n}`).toBe(true);
      expect(r.espectadores.length > 0, `n=${n}`).toBe(n === 8 || n === 9);
      for (const m of r.mesas) expect(m.carmen === null || m.ids.length === 7, `n=${n}`).toBe(true);
    }
  });
});

describe('roles', () => {
  it('rolesParaTamano reparte los roles del proceso', () => {
    expect(rolesParaTamano(5)).toEqual([['PO'], ['SD'], ['AN'], ['QA'], ['FR', 'RT']]);
    expect(rolesParaTamano(6)).toEqual([['PO'], ['SD'], ['FR'], ['AN'], ['QA'], ['RT']]);
    expect(rolesParaTamano(7)).toEqual([['PO'], ['SD'], ['FR'], ['AN'], ['QA'], ['RT'], ['SD2']]);
  });

  it('asignarRoles da SD2 a carmen y un rol a cada persona', () => {
    const r = repartirMesas(ids(40));
    const roles = asignarRoles(r.mesas[2], () => 0.5);
    expect(roles['p37']).toEqual(['SD2']);
    const todos = Object.values(roles).flat().sort();
    expect(todos).toEqual(['AN', 'FR', 'PO', 'QA', 'RT', 'SD', 'SD2']);
  });
});

describe('ubicarTarde', () => {
  const mesa = (numero: number, roles: Rol[][]) => ({
    numero,
    miembros: Object.fromEntries(roles.map((r, i) => [`m${numero}-${i}`, r])),
  });

  it('prefiere el RT de una mesa de cinco y libera al FR', () => {
    const r = ubicarTarde([mesa(1, rolesParaTamano(6)), mesa(2, rolesParaTamano(5))]);
    expect(r).toEqual({ mesa: 2, roles: ['RT'], liberar: { id: 'm2-4', roles: ['FR'] } });
  });

  it('da SD2 en la mesa de seis con menos gente', () => {
    const r = ubicarTarde([mesa(1, rolesParaTamano(7)), mesa(2, rolesParaTamano(6))]);
    expect(r).toEqual({ mesa: 2, roles: ['SD2'] });
  });

  it('devuelve null si todas tienen siete', () => {
    expect(ubicarTarde([mesa(1, rolesParaTamano(7))])).toBeNull();
  });
});

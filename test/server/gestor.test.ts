import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Almacen } from '../../src/server/almacen.js';
import { GestorSesiones } from '../../src/server/gestor.js';
import { contenidoMinimo } from '../fixtures/contenido.js';
import { T0 } from '../fixtures/escenario.js';

const MIN = 60_000;

function nuevoGestor(dir: string, reloj: { t: number }) {
  const g = new GestorSesiones({ almacen: new Almacen(dir), contenidoBase: contenidoMinimo(), ahora: () => reloj.t, azar: () => 0.3 });
  g.cargar();
  return g;
}

function unir(g: GestorSesiones, codigo: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const r = g.unirse(codigo, `p${i + 1}`, true);
    if ('error' in r) throw new Error(r.error);
    return r.participanteId;
  });
}

describe('GestorSesiones', () => {
  let dir: string;
  const reloj = { t: T0 };
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tomatera-g-')); reloj.t = T0; });

  it('crear da códigos de seis dígitos distintos', () => {
    const g = nuevoGestor(dir, reloj);
    const codigos = Array.from({ length: 20 }, () => g.crear({ prueba: true, velocidad: 1 }).codigo);
    expect(codigos.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codigos).size).toBe(20);
  });

  it('unirse con código erróneo o sin consentimiento falla con un mensaje claro', () => {
    const g = nuevoGestor(dir, reloj);
    const s = g.crear({ prueba: true, velocidad: 1 });
    const otro = s.codigo === '999999' ? '999998' : '999999';
    expect(g.unirse(otro, 'Ana', true)).toEqual({ error: 'Código de sesión incorrecto' });
    expect(g.unirse(s.codigo, 'Ana', false)).toEqual({ error: 'Hay que aceptar el consentimiento para participar' });
  });

  it('el mismo opId dos veces deja un solo evento', () => {
    const g = nuevoGestor(dir, reloj);
    const s = g.crear({ prueba: true, velocidad: 1 });
    unir(g, s.codigo, 6);
    const c = { opId: 'op-repetido', tipo: 'cerrarInscripcion' as const, datos: {} };
    expect(g.ejecutar(s.id, { tipo: 'leandro' }, c)).toEqual({ ok: true });
    const antes = g.eventos(s.id).length;
    expect(g.ejecutar(s.id, { tipo: 'leandro' }, c)).toEqual({ ok: true });
    expect(g.eventos(s.id).length).toBe(antes);
  });

  it('un gestor nuevo sobre el mismo directorio llega al mismo estado y no relanza ronda1', () => {
    const g = nuevoGestor(dir, reloj);
    const s = g.crear({ prueba: true, velocidad: 1 });
    unir(g, s.codigo, 6);
    g.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'a', tipo: 'cerrarInscripcion', datos: {} });
    for (let i = 0; i < 5; i++) g.ejecutar(s.id, { tipo: 'autores' }, { opId: `t${i}`, tipo: 'avanzarTramo', datos: {} });
    expect(g.estado(s.id)?.tramoIndice).toBe(4);
    reloj.t = T0 + 3 * MIN;
    g.tick();
    expect(g.estado(s.id)?.mesas[1].rondas).toHaveLength(1);

    const g2 = nuevoGestor(dir, reloj);
    expect(g2.estado(s.id)).toEqual(g.estado(s.id));
    const antes = g2.eventos(s.id).length;
    reloj.t += 1000;
    g2.tick();
    expect(g2.eventos(s.id).length).toBe(antes);
    expect(g2.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'a', tipo: 'cerrarInscripcion', datos: {} })).toEqual({ ok: true });
    expect(g2.eventos(s.id).length).toBe(antes);
  });

  it('una sesión que no se puede reconstruir no impide cargar las demás', () => {
    const g = nuevoGestor(dir, reloj);
    const buena = g.crear({ prueba: false, velocidad: 1 });
    const mala = g.crear({ prueba: true, velocidad: 1 });
    // Un evento de mesa sin mesas: el reductor no lo puede aplicar.
    new Almacen(dir).agregar(mala.id, { seq: 2, en: T0, tipo: 'plantilla.reabierta', por: { tipo: 'autores' }, mesa: 9, datos: { tramo: 'a51' } } as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const otro = nuevoGestor(dir, reloj);
    expect(otro.estado(buena.id)).toBeDefined();
    expect(otro.estado(mala.id)).toBeUndefined();
    expect(otro.erroresDeCarga().map((x) => x.id)).toEqual([mala.id]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('quien se une después del cierre ocupa el RT de la mesa de cinco', () => {
    const g = nuevoGestor(dir, reloj);
    const s = g.crear({ prueba: true, velocidad: 1 });
    unir(g, s.codigo, 11);
    g.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'a', tipo: 'cerrarInscripcion', datos: {} });
    const doble = Object.values(g.estado(s.id)!.participantes).find((p) => p.roles.length === 2)!;
    const r = g.unirse(s.codigo, 'Tarde', true);
    if ('error' in r) throw new Error(r.error);
    const e = g.estado(s.id)!;
    expect(e.participantes[r.participanteId]).toMatchObject({ mesa: doble.mesa, roles: ['RT'] });
    expect(e.participantes[doble.id].roles).toEqual(['FR']);
  });

  it('alCambiar se llama después de ejecutar y de tick', () => {
    const g = nuevoGestor(dir, reloj);
    const s = g.crear({ prueba: true, velocidad: 1 });
    const avisos: string[] = [];
    g.alCambiar((id) => avisos.push(id));
    unir(g, s.codigo, 6);
    g.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'a', tipo: 'cerrarInscripcion', datos: {} });
    g.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'b', tipo: 'avanzarTramo', datos: {} });
    const n = avisos.length;
    reloj.t = T0 + 7 * MIN;
    g.tick();
    expect(avisos.length).toBeGreaterThan(n);
    expect(new Set(avisos)).toEqual(new Set([s.id]));
  });
});

import { leerE5 } from '../../src/shared/lecturas.js';
import { revisarReloj } from '../../src/server/reloj.js';
import { Escenario, T0 } from '../fixtures/escenario.js';

const MIN = 60_000;
const tipos = (evs: { tipo: string }[]) => evs.map((e) => e.tipo);

function aplicarTodo(e: Escenario, evs: ReturnType<typeof revisarReloj>) {
  for (const x of evs) e.aplicar(x);
}

describe('revisarReloj', () => {
  it('en a51 + 3 min lanza la ronda 1 y marca el hito ronda1', () => {
    const e = new Escenario();
    e.irA('a51');
    expect(revisarReloj(e.estado, T0 + 3 * MIN - 1000)).toEqual([]);
    const evs = revisarReloj(e.estado, T0 + 3 * MIN);
    expect(tipos(evs)).toEqual(['ronda.lanzada', 'hito.hecho']);
    expect(evs[0]).toMatchObject({ por: { tipo: 'sistema' }, datos: { numero: 1 } });
  });

  it('no relanza un hito ya hecho', () => {
    const e = new Escenario();
    e.irA('a51');
    aplicarTodo(e, revisarReloj(e.estado, T0 + 3 * MIN));
    expect(revisarReloj(e.estado, T0 + 3 * MIN + 500)).toEqual([]);
  });

  it('a los 60 s del lanzamiento revela la ronda en las mesas que todavía no la revelaron', () => {
    const e = new Escenario(12);
    e.irA('a51');
    e.ahora = T0 + MIN;
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    expect(revisarReloj(e.estado, T0 + 2 * MIN - 1000)).toEqual([]);
    const evs = revisarReloj(e.estado, T0 + 2 * MIN);
    expect(tipos(evs)).toEqual(['ronda.revelada', 'ronda.revelada']);
    expect(evs.map((x) => x.mesa)).toEqual([1, 2]);
  });

  it('al terminar A5.1, la ronda que seguía sin revelarse se revela aunque no pasaron los 60 s', () => {
    const e = new Escenario(6);
    e.irA('a51');
    e.ahora = T0 + MIN;
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    e.irA('a52');
    const evs = revisarReloj(e.estado, T0 + MIN + 5000);
    expect(tipos(evs).filter((t) => t === 'ronda.revelada')).toHaveLength(1);
  });

  it('con 59 s de tiempo extra no avanza y con 60 s inicia el siguiente tramo', () => {
    const e = new Escenario();
    e.irA('a4');
    expect(revisarReloj(e.estado, T0 + 4 * MIN + 59_000)).toEqual([]);
    const evs = revisarReloj(e.estado, T0 + 4 * MIN + 60_000);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ tipo: 'tramo.iniciado', datos: { indice: 4 } });
  });

  it('con el avance automático apagado no avanza', () => {
    const e = new Escenario();
    e.irA('a4');
    e.ok('autores', 'cambiarAvance', { automatico: false });
    expect(revisarReloj(e.estado, T0 + 10 * MIN)).toEqual([]);
  });

  it('en pausa no genera nada', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok('leandro', 'pausar');
    expect(revisarReloj(e.estado, T0 + 30 * MIN)).toEqual([]);
  });

  it('en a6 + 2 min congela las mesas y asigna el traspaso en rotación', () => {
    const e = new Escenario(18);
    e.irA('a6');
    e.ok(e.quien('RT', 2), 'congelarLineaBase');
    const evs = revisarReloj(e.estado, T0 + 2 * MIN);
    const congeladas = evs.filter((x) => x.tipo === 'lineabase.congelada').map((x) => x.mesa);
    expect(congeladas).toEqual([1, 3]);
    aplicarTodo(e, evs);
    const m = e.estado.mesas;
    expect(m[2].traspaso).toMatchObject({ lectorId: e.quien('QA', 1), lectorMesa: 1 });
    expect(m[3].traspaso).toMatchObject({ lectorId: e.quien('QA', 2), lectorMesa: 2 });
    expect(m[1].traspaso).toMatchObject({ lectorId: e.quien('QA', 3), lectorMesa: 3 });
    expect(e.estado.hitosHechos).toContain('congelar');
  });

  it('con una sola mesa congela y no asigna traspaso', () => {
    const e = new Escenario();
    e.irA('a6');
    const evs = revisarReloj(e.estado, T0 + 2 * MIN);
    expect(tipos(evs)).toEqual(['lineabase.congelada', 'hito.hecho']);
  });

  it('si la mesa vecina no tiene críticas, E5 queda pendiente sin romperse', () => {
    const e = new Escenario(12);
    e.irA('a6');
    aplicarTodo(e, revisarReloj(e.estado, T0 + 2 * MIN));
    expect(e.estado.mesas[2].traspaso.items).toEqual({});
    expect(leerE5(e.estado.mesas[2]).texto).toBe('Pendiente: no hay críticos en la línea base');
  });

  it('al terminar el destape con tiempo extra emite sesion.cerrada', () => {
    const e = new Escenario();
    e.irA('destape');
    const evs = revisarReloj(e.estado, T0 + 7 * MIN + 60_000);
    expect(tipos(evs)).toEqual(['sesion.cerrada']);
  });

  it('una sesión acelerada ×60 escala los hitos y la gracia', () => {
    const e = new Escenario();
    e.estado = { ...e.estado, velocidad: 60 };
    e.irA('a51');
    expect(tipos(revisarReloj(e.estado, T0 + 3000))).toEqual(['ronda.lanzada', 'hito.hecho']);
  });
});

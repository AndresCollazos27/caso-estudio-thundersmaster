import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Almacen } from '../../src/server/almacen.js';
import { exportarSesion } from '../../src/server/exportar.js';
import { GestorSesiones } from '../../src/server/gestor.js';
import { reanudarSimulados, simular } from '../../src/server/simulador.js';
import { lecturasMesa } from '../../src/shared/lecturas.js';
import { contenidoReal } from '../fixtures/contenido.js';

const LEANDRO = { tipo: 'leandro' } as const;

function preparar(velocidad: number) {
  let t = 1_800_000_000_000;
  const gestor = new GestorSesiones({
    almacen: new Almacen(mkdtempSync(join(tmpdir(), 'tomatera-sim-'))), contenidoBase: contenidoReal(), ahora: () => t,
  });
  const s = gestor.crear({ prueba: true, velocidad });
  const iniciar = () => {
    expect(gestor.ejecutar(s.id, LEANDRO, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} })).toEqual({ ok: true });
    expect(gestor.ejecutar(s.id, LEANDRO, { opId: 'l2', tipo: 'avanzarTramo', datos: {} })).toEqual({ ok: true });
  };
  return { gestor, s, iniciar, avanzar: (ms: number) => { t += ms; } };
}

describe('simulador', () => {
  it('una sesión de prueba ×600 con 40 bots llega al cierre', () => {
    const inicio = performance.now();
    const { gestor, s, iniciar, avanzar } = preparar(600);
    const sim = simular(gestor, s.id, 40, { semilla: 7 });
    iniciar();
    for (let i = 0; i < 200 && gestor.estado(s.id)?.estado !== 'cerrada'; i++) {
      avanzar(500);
      gestor.tick();
      sim.paso();
    }

    const e = gestor.estado(s.id)!;
    expect(e.estado).toBe('cerrada');
    const mesas = Object.values(e.mesas);
    expect(mesas).toHaveLength(6);
    for (const m of mesas) {
      expect(m.lineaBase.congeladaEn).toBeDefined();
      expect(m.divergencias.length).toBeGreaterThan(0);
      expect(m.necesidades.length).toBeGreaterThanOrEqual(3);
      expect(m.tarjetas.length).toBeGreaterThan(0);
      expect(m.rondas.every((r) => r.reveladaEn !== undefined && r.items.every((i) => r.resultados[i.id]))).toBe(true);
      expect(Object.values(m.traspaso.items).some((x) => x.reconstruccion)).toBe(true);
      expect(() => lecturasMesa(m)).not.toThrow();
    }
    const ids = Object.keys(e.participantes);
    expect(ids).toHaveLength(40);
    for (const id of ids) {
      expect(e.medicion[id]?.previa).toHaveLength(4);
      expect(e.medicion[id]?.posterior).toHaveLength(4);
    }
    expect(Object.keys(e.cuestionario)).toHaveLength(40);
    expect(sim.rechazos).toEqual([]);

    const x = exportarSesion(e, gestor.eventos(s.id));
    expect(x.mesas.map((m) => m.numero)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(x.eventos).toHaveLength(gestor.eventos(s.id).length);
    expect(JSON.stringify(x)).not.toContain('Simulado');
    expect(performance.now() - inicio).toBeLessThan(20_000);
  });

  it('tras reiniciar el servidor, los simulados retoman la sesión sin repetir acciones', () => {
    let t = 1_800_000_000_000;
    const dir = mkdtempSync(join(tmpdir(), 'tomatera-sim-'));
    const almacenes: Almacen[] = [];
    const arrancar = () => {
      const almacen = new Almacen(dir);
      almacenes.push(almacen);
      const g = new GestorSesiones({ almacen, contenidoBase: contenidoReal(), ahora: () => t });
      g.cargar();
      return g;
    };
    const g1 = arrancar();
    const s = g1.crear({ prueba: true, velocidad: 600 });
    const sim1 = simular(g1, s.id, 12, { semilla: 3 });
    g1.ejecutar(s.id, LEANDRO, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} });
    g1.ejecutar(s.id, LEANDRO, { opId: 'l2', tipo: 'avanzarTramo', datos: {} });
    for (let i = 0; i < 100 && g1.estado(s.id)?.tramoIndice !== 7; i++) {
      t += 500;
      g1.tick();
      sim1.paso();
    }
    expect(g1.estado(s.id)?.tramoIndice).toBe(7);
    almacenes[0].cerrar();

    const g2 = arrancar();
    const sim2 = reanudarSimulados(g2, s.id, { semilla: 3 });
    for (let i = 0; i < 100 && g2.estado(s.id)?.estado !== 'cerrada'; i++) {
      t += 500;
      g2.tick();
      sim2.paso();
    }
    const e = g2.estado(s.id)!;
    expect(e.estado).toBe('cerrada');
    expect(Object.keys(e.participantes)).toHaveLength(12);
    expect(Object.keys(e.cuestionario)).toHaveLength(12);
    expect(sim2.rechazos).toEqual([]);
    for (const m of Object.values(e.mesas)) expect(m.acciones.length).toBeLessThanOrEqual(2);
    almacenes[1].cerrar();
  });

  it('si los autores repiten una ronda, los simulados la vuelven a responder', () => {
    const { gestor, s, iniciar, avanzar } = preparar(60);
    const sim = simular(gestor, s.id, 6, { semilla: 2 });
    iniciar();
    gestor.ejecutar(s.id, { tipo: 'autores' }, { opId: 'a0', tipo: 'cambiarAvance', datos: { automatico: false } });
    for (let i = 0; i < 4; i++) gestor.ejecutar(s.id, LEANDRO, { opId: `t${i}`, tipo: 'avanzarTramo', datos: {} });
    const pasos = () => {
      for (let i = 0; i < 6; i++) {
        avanzar(500);
        gestor.tick();
        sim.paso();
      }
    };
    pasos(); // leen su carta antes de la ronda
    gestor.ejecutar(s.id, LEANDRO, { opId: 'r1', tipo: 'lanzarRonda', datos: { numero: 1 } });
    pasos();
    expect(gestor.estado(s.id)!.mesas[1].rondas[0].reveladaEn).toBeDefined();
    expect(Object.keys(gestor.estado(s.id)!.mesas[1].rondas[0].respuestas.guia ?? {})).toHaveLength(6);
    expect(gestor.ejecutar(s.id, { tipo: 'autores' }, { opId: 'rep', tipo: 'repetirRonda', datos: { mesa: 1, numero: 1 } })).toEqual({ ok: true });
    pasos();
    expect(Object.keys(gestor.estado(s.id)!.mesas[1].rondas[0].respuestas.guia ?? {})).toHaveLength(6);
    expect(sim.rechazos).toEqual([]);
  });

  it('después de detener(), los bots no hacen nada más', () => {
    const { gestor, s, iniciar, avanzar } = preparar(600);
    const sim = simular(gestor, s.id, 6, { semilla: 1 });
    iniciar();
    sim.detener();
    const antes = gestor.eventos(s.id).length;
    for (let i = 0; i < 5; i++) {
      avanzar(500);
      gestor.tick();
      sim.paso();
    }
    expect(gestor.eventos(s.id).slice(antes).filter((ev) => ev.por.tipo === 'participante')).toEqual([]);
  });
});

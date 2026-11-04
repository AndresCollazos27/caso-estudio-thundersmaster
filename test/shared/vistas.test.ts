import { vistaAutores, vistaJugador, vistaLeandro } from '../../src/shared/vistas.js';
import { contenidoReal } from '../fixtures/contenido.js';
import { Escenario, T0 } from '../fixtures/escenario.js';

const json = (x: unknown) => JSON.stringify(x);
const URL_PUBLICA = 'http://203.0.113.24:8090';

describe('vistaJugador', () => {
  it('el QA no recibe la carta del PO y el PO sí la suya', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('lectura');
    expect(json(vistaJugador(e.estado, e.quien('QA'), T0))).not.toContain('bomba');
    expect(json(vistaJugador(e.estado, e.quien('PO'), T0))).toContain('bomba');
  });

  it('antes de la revelación no llegan respuestas ajenas, y después sí', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    e.ok(e.quien('AN'), 'responderRonda', { numero: 1, itemId: 'guia', texto: 'Respuesta secreta del AN' });
    const antes = vistaJugador(e.estado, e.quien('PO'), T0);
    expect(json(antes)).not.toContain('Respuesta secreta del AN');
    expect(json(vistaJugador(e.estado, e.quien('AN'), T0))).toContain('Respuesta secreta del AN');
    e.aplicar({ en: T0, tipo: 'ronda.revelada', por: { tipo: 'sistema' }, mesa: 1, datos: { numero: 1 } });
    expect(json(vistaJugador(e.estado, e.quien('PO'), T0))).toContain('Respuesta secreta del AN');
  });

  it('no llega nada de otra mesa', () => {
    const e = new Escenario(12, contenidoReal());
    e.irA('a51');
    e.ok(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Necesidad secreta de la mesa dos', fuente: 'Lucía Ferrer, dueña' });
    expect(json(vistaJugador(e.estado, e.quien('AN', 1), T0))).not.toContain('Necesidad secreta de la mesa dos');
    expect(json(vistaJugador(e.estado, e.quien('PO', 2), T0))).toContain('Necesidad secreta de la mesa dos');
  });

  it('en a52 el PO recibe tarjetas vacías y el AN las recibe completas', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a51');
    e.ok(e.quien('AN'), 'guardarNecesidad', { necesidad: 'Riego', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN'), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Tarjeta en construcción', critico: 'Sí' });
    expect(vistaJugador(e.estado, e.quien('PO'), T0).mesa?.tarjetas).toEqual([]);
    expect(vistaJugador(e.estado, e.quien('AN'), T0).mesa?.tarjetas).toHaveLength(1);
    e.irA('a53');
    expect(vistaJugador(e.estado, e.quien('PO'), T0).mesa?.tarjetas).toHaveLength(1);
  });

  it('en la medición posterior no llega la respuesta previa', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('medicion_previa');
    const p = e.quien('SD');
    e.ok(p, 'responderMedicion', { fase: 'previa', respuestas: ['Respuesta previa única', '10', 'Avisa', 'Marzo'] });
    e.irA('medicion_posterior');
    const v = vistaJugador(e.estado, p, T0);
    expect(json(v)).not.toContain('Respuesta previa única');
    expect(v.medicion).toMatchObject({ fase: 'posterior', respondida: false });
  });

  it('el FR+RT recibe las instrucciones de los dos roles', () => {
    const c = contenidoReal();
    const e = new Escenario(5, c);
    e.irA('a4');
    const v = vistaJugador(e.estado, e.quien('FR'), T0);
    const a4 = c.agenda.find((t) => t.id === 'a4')!;
    expect(v.ahora.paraMi).toEqual([a4.porRol.FR, a4.porRol.RT]);
    expect(v.lecturas).not.toBeNull();
  });

  it('SD2 recibe sus propias instrucciones y su propia carta', () => {
    const c = contenidoReal();
    const e = new Escenario(7, c);
    e.irA('a51');
    const v = vistaJugador(e.estado, e.quien('SD2'), T0);
    expect(v.ahora.paraMi).toEqual([c.agenda.find((t) => t.id === 'a51')!.porRol.SD2]);
    expect(v.carta?.quienEres).toContain('Carmen');
    expect(v.lecturas).toBeNull();
  });

  it('si el contenido no trae textos para SD2, Carmen recibe los del SD', () => {
    const c = contenidoReal();
    for (const t of c.agenda) delete t.porRol.SD2;
    const e = new Escenario(7, c);
    e.irA('a51');
    expect(vistaJugador(e.estado, e.quien('SD2'), T0).ahora.paraMi).toEqual([c.agenda.find((t) => t.id === 'a51')!.porRol.SD]);
  });

  it('un espectador recibe solo el tramo y paraTodos', () => {
    const e = new Escenario(9, contenidoReal());
    e.irA('a4');
    const v = vistaJugador(e.estado, 'p8', T0);
    expect(v.yo.espectador).toBe(true);
    expect(v.mesa).toBeNull();
    expect(v.carta).toBeNull();
    expect(v.ahora.paraMi).toEqual([]);
    expect(v.ahora.paraTodos).toBeTruthy();
  });

  it('la ficha técnica aparece solo después de pedirla', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a51');
    const p = e.quien('AN');
    expect(vistaJugador(e.estado, p, T0).fichaTecnica).toBeNull();
    e.ok(p, 'pedirFicha');
    expect(vistaJugador(e.estado, p, T0).fichaTecnica?.url).toContain('verdeesvida');
  });
});

describe('vistaLeandro y vistaAutores', () => {
  it('Leandro no recibe cartas ni respuestas', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    e.ok(e.quien('AN'), 'responderRonda', { numero: 1, itemId: 'guia', texto: 'Respuesta secreta del AN' });
    expect(vistaLeandro(e.estado, T0, URL_PUBLICA).mesas[0].ronda?.respondieron).toBe(0);
    e.ok(e.quien('AN'), 'responderRonda', { numero: 1, itemId: 'sustrato', texto: '30' });
    const v = vistaLeandro(e.estado, T0, URL_PUBLICA);
    expect(json(v)).not.toContain('bomba');
    expect(json(v)).not.toContain('Respuesta secreta del AN');
    expect(v.enlace).toBe('http://203.0.113.24:8090/?c=123456');
    expect(v.mesas[0].ronda).toMatchObject({ numero: 1, respondieron: 1, total: 6 });
  });

  it('durante una ronda, Leandro recibe cuándo termina su cuenta de 60 segundos', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    const lanzada = e.estado.mesas[1].rondas[0].lanzadaEn;
    // El estado de prueba va a velocidad 1: la cuenta dura 60 s reales.
    expect(vistaLeandro(e.estado, T0, URL_PUBLICA).mesas[0].ronda?.terminaEn).toBe(lanzada + 60_000 / e.estado.velocidad);
  });

  it('antes de cerrar la inscripción Leandro ve las mesas provisionales de seis', () => {
    const e = new Escenario(14, contenidoReal(), false);
    const v = vistaLeandro(e.estado, T0, URL_PUBLICA);
    expect(v.mesas.map((m) => m.personas)).toEqual([6, 6, 2]);
  });

  it('los autores reciben todo y las lecturas por mesa', () => {
    const e = new Escenario(6, contenidoReal());
    e.irA('a4');
    const v = vistaAutores(e.estado, T0);
    expect(json(v)).toContain('bomba');
    expect(v.lecturas[1].E1.texto).toBe('Pendiente: faltan reformulaciones de los perfiles críticos');
  });
});

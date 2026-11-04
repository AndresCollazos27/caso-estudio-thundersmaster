import { filaI2C, resultadoFilaI2C } from '../../src/shared/lecturas.js';
import { vistaJugador } from '../../src/shared/vistas.js';
import { Escenario } from '../fixtures/escenario.js';

describe('procesarComando', () => {
  it('el PO escribe su versión en a4 y el QA no puede', () => {
    const e = new Escenario();
    e.irA('a4');
    const ev = e.ok(e.quien('PO'), 'escribirVersion', { texto: 'Que riegue sola' });
    expect(ev.map((x) => x.tipo)).toEqual(['apertura.version']);
    expect(e.estado.mesas[1].apertura.versiones.PO?.texto).toBe('Que riegue sola');
    const r = e.ejecutar(e.quien('QA'), 'escribirVersion', { texto: 'x' });
    expect(r).toEqual({ ok: false, error: 'Tu rol no puede hacer esto en este tramo' });
  });

  it('marcar «No» en la apertura crea D-01 con «A4 apertura»', () => {
    const e = new Escenario();
    e.irA('a4');
    e.ok(e.quien('FR'), 'marcarEquivalencia', { perfil: 'AN', valor: 'No' });
    const d = e.estado.mesas[1].divergencias;
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ id: 'D-01', detectadaEn: 'A4 apertura', afectaA: '', estado: 'Pendiente' });
    expect(e.estado.mesas[1].apertura.equivalencia.AN).toBe('No');
  });

  it('marcar «Pendiente» en una ronda crea una divergencia y la enlaza', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    for (const p of Object.keys(e.estado.mesas[1].miembros)) e.ok(p, 'responderRonda', { numero: 1, itemId: 'guia', texto: `respuesta de ${p}` });
    e.ok(e.quien('FR'), 'marcarRonda', { numero: 1, itemId: 'guia', resultado: 'Pendiente' });
    const m = e.estado.mesas[1];
    expect(m.divergencias[0]).toMatchObject({ id: 'D-01', detectadaEn: 'I3 paráfrasis cruzada', afectaA: 'T-01', estado: 'Pendiente' });
    expect(m.rondas[0].resultados.guia).toMatchObject({ resultado: 'Pendiente', divergenciaId: 'D-01' });
  });

  it('cuando responde el último integrante de la mesa se emite ronda.revelada para esa mesa', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    const miembros = Object.keys(e.estado.mesas[1].miembros);
    for (const p of miembros.slice(0, -1)) {
      expect(e.ok(p, 'responderRonda', { numero: 1, itemId: 'guia', texto: 'x' }).map((x) => x.tipo)).toEqual(['ronda.respondida']);
    }
    const ultimo = e.ok(miembros[miembros.length - 1], 'responderRonda', { numero: 1, itemId: 'guia', texto: 'x' });
    expect(ultimo.map((x) => x.tipo)).toEqual(['ronda.respondida', 'ronda.revelada']);
    expect(ultimo[1].mesa).toBe(1);
  });

  it('C2 «No» crea una divergencia con «I2 aceptación» y afectaA R-01', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok(e.quien('AN'), 'guardarNecesidad', { necesidad: 'Saber cuándo regar', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN'), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de riego', critico: 'Sí' });
    e.irA('a53');
    e.ok(e.quien('PO'), 'marcarI2C', { tarjetaId: 'R-01', campo: 'C2', valor: 'No' });
    const m = e.estado.mesas[1];
    expect(m.divergencias[0]).toMatchObject({ detectadaEn: 'I2 aceptación', afectaA: 'R-01' });
    expect(m.i2c['R-01']).toMatchObject({ C2: 'No', divergenciaId: m.divergencias[0].id });
  });

  it('en A5.3 el cliente escribe lo que espera de un crítico que salió de una necesidad media, y la fila puede quedar «Aceptado»', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok(e.quien('AN'), 'guardarNecesidad', { necesidad: 'Saber si hay sol', fuente: 'Lucía Ferrer, dueña', prioridad: 'Media' });
    e.irA('a52');
    e.ok(e.quien('AN'), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de poca luz', critico: 'Sí' });
    e.irA('a53');
    e.ok(e.quien('PO'), 'escribirEsperado', { necesidadId: 'N-01', texto: 'Que me diga si le falta sol' });
    for (const campo of ['C1', 'C2'] as const) e.ok(e.quien('PO'), 'marcarI2C', { tarjetaId: 'R-01', campo, valor: 'Sí' });
    e.ok(e.quien('FR'), 'marcarI2C', { tarjetaId: 'R-01', campo: 'C3', valor: 'Sí' });
    expect(resultadoFilaI2C(filaI2C(e.estado.mesas[1], 'R-01'))).toBe('Aceptado');
  });

  it('un texto de 601 caracteres se rechaza', () => {
    const e = new Escenario();
    e.irA('a4');
    const r = e.ejecutar(e.quien('PO'), 'escribirVersion', { texto: 'a'.repeat(601) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('El texto pasa de 600 caracteres');
  });

  it('un texto con etiquetas y emojis se guarda tal cual', () => {
    const e = new Escenario();
    e.irA('a4');
    e.ok(e.quien('SD'), 'escribirVersion', { texto: '<script>alert(1)</script> 🍅' });
    expect(e.estado.mesas[1].apertura.versiones.SD?.texto).toBe('<script>alert(1)</script> 🍅');
  });

  it('el FR+RT de una mesa de cinco puede marcar equivalencias y congelar', () => {
    const e = new Escenario(5);
    const doble = e.quien('FR');
    expect(e.estado.participantes[doble].roles).toEqual(['FR', 'RT']);
    e.irA('a4');
    e.ok(doble, 'marcarEquivalencia', { perfil: 'PO', valor: 'Sí' });
    e.irA('a6');
    e.ok(doble, 'congelarLineaBase');
    expect(e.estado.mesas[1].lineaBase.congeladaEn).toBeDefined();
  });

  it('SD2 puede escribir el resultado esperado en a52, pero no una versión en a4', () => {
    const e = new Escenario(7);
    const carmen = e.quien('SD2');
    e.irA('a4');
    expect(e.ejecutar(carmen, 'escribirVersion', { texto: 'x' }).ok).toBe(false);
    e.irA('a51');
    e.ok(e.quien('AN'), 'guardarNecesidad', { necesidad: 'Saber si hay sol', fuente: 'Carmen Ortega, clienta', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(carmen, 'escribirEsperado', { necesidadId: 'N-01', texto: 'Que me diga si le falta sol' });
    expect(e.estado.mesas[1].esperadosPorNecesidad['N-01']).toBe('Que me diga si le falta sol');
  });

  it('con a51 reabierto para la mesa 2, su AN guarda una necesidad en a52', () => {
    const e = new Escenario(12);
    e.irA('a52');
    expect(e.ejecutar(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Tarde', fuente: 'Lucía Ferrer, dueña' }).ok).toBe(false);
    e.ok('autores', 'reabrirPlantilla', { mesa: 2, tramo: 'a51' });
    e.ok(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Tarde', fuente: 'Lucía Ferrer, dueña' });
    expect(e.estado.mesas[2].necesidades).toHaveLength(1);
    expect(e.ejecutar(e.quien('AN', 1), 'guardarNecesidad', { necesidad: 'Tarde', fuente: 'Lucía Ferrer, dueña' }).ok).toBe(false);
  });

  it('una prioridad «Altísima» se rechaza nombrando el campo', () => {
    const e = new Escenario();
    e.irA('a51');
    const r = e.ejecutar(e.quien('AN'), 'guardarNecesidad', { necesidad: 'x', fuente: 'y', prioridad: 'Altísima' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('prioridad');
  });

  it('cerrarInscripcion emite inscripcion.cerrada con miembros y espectadores', () => {
    const e = new Escenario(9, undefined, false);
    const ev = e.ok('leandro', 'cerrarInscripcion');
    expect(ev[0].tipo).toBe('inscripcion.cerrada');
    expect(e.estado.mesas[1].miembros.p7).toEqual(['SD2']);
    expect(Object.keys(e.estado.mesas[1].miembros)).toHaveLength(7);
    expect(e.estado.participantes.p8.espectador).toBe(true);
    expect(e.ejecutar('leandro', 'cerrarInscripcion').ok).toBe(false);
  });

  it('cerrar la inscripción con menos de 5 personas devuelve el error del reparto', () => {
    const e = new Escenario(3, undefined, false);
    expect(e.ejecutar('leandro', 'cerrarInscripcion')).toEqual({ ok: false, error: 'Se necesitan al menos 5 personas para cerrar la inscripción' });
  });

  it('el lector del traspaso es quien tenga el QA de la mesa lectora, aunque los autores le hayan pasado el rol a otra persona', () => {
    const e = new Escenario(12);
    e.irA('a51');
    e.ok(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Riego', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN', 2), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de riego', critico: 'Sí' });
    e.irA('a6');
    e.ok(e.quien('RT', 2), 'congelarLineaBase');
    const qaViejo = e.quien('QA', 1);
    const nuevo = e.quien('AN', 1);
    e.aplicar({ en: e.ahora, tipo: 'traspaso.asignado', por: { tipo: 'sistema' }, mesa: 2, datos: { lectorId: qaViejo, lectorMesa: 1 } });
    // Al QA de la mesa 1 se le apagó el celular: los autores le pasan el rol a otra persona de esa mesa.
    e.ok('autores', 'moverParticipante', { participanteId: nuevo, mesa: 1, roles: ['QA'] });
    e.ok('autores', 'moverParticipante', { participanteId: qaViejo, mesa: 1, roles: ['AN'] });
    expect(e.ejecutar(qaViejo, 'reconstruir', { tarjetaId: 'R-01', texto: 'x' }).ok).toBe(false);
    expect(vistaJugador(e.estado, nuevo, e.ahora).traspaso.comoLector?.mesa).toBe(2);
    e.ok(nuevo, 'reconstruir', { tarjetaId: 'R-01', texto: 'Avisa cuando está seca' });
    expect(e.estado.mesas[2].traspaso.items['R-01'].reconstruccion).toBe('Avisa cuando está seca');
  });

  it('reconstruir solo lo puede hacer el lector asignado', () => {
    const e = new Escenario(12);
    e.irA('a51');
    e.ok(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Riego', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN', 2), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de riego', critico: 'Sí' });
    e.irA('a6');
    e.ok(e.quien('RT', 2), 'congelarLineaBase');
    e.aplicar({ en: e.ahora, tipo: 'traspaso.asignado', por: { tipo: 'sistema' }, mesa: 2, datos: { lectorId: e.quien('QA', 1), lectorMesa: 1 } });
    expect(e.ejecutar(e.quien('QA', 2), 'reconstruir', { tarjetaId: 'R-01', texto: 'x' }).ok).toBe(false);
    e.ok(e.quien('QA', 1), 'reconstruir', { tarjetaId: 'R-01', texto: 'Avisa cuando está seca' });
    expect(e.estado.mesas[2].traspaso.items['R-01'].reconstruccion).toBe('Avisa cuando está seca');
    e.ok(e.quien('PO', 2), 'confirmarTraspaso', { tarjetaId: 'R-01', coincide: 'No', correccion: 'Falta el umbral' });
    expect(e.estado.mesas[2].divergencias.at(-1)).toMatchObject({ detectadaEn: 'Prueba de traspaso', afectaA: 'R-01' });
  });

  it('confirmar otra vez «No» en el traspaso (para guardar la corrección) no duplica la divergencia', () => {
    const e = new Escenario(12);
    e.irA('a51');
    e.ok(e.quien('AN', 2), 'guardarNecesidad', { necesidad: 'Riego', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN', 2), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de riego', critico: 'Sí' });
    e.irA('a6');
    e.ok(e.quien('RT', 2), 'congelarLineaBase');
    e.aplicar({ en: e.ahora, tipo: 'traspaso.asignado', por: { tipo: 'sistema' }, mesa: 2, datos: { lectorId: e.quien('QA', 1), lectorMesa: 1 } });
    e.ok(e.quien('QA', 1), 'reconstruir', { tarjetaId: 'R-01', texto: 'Avisa cuando está seca' });
    e.ok(e.quien('PO', 2), 'confirmarTraspaso', { tarjetaId: 'R-01', coincide: 'No' });
    e.ok(e.quien('PO', 2), 'confirmarTraspaso', { tarjetaId: 'R-01', coincide: 'No', correccion: 'Falta el umbral' });
    const m = e.estado.mesas[2];
    expect(m.divergencias.filter((d) => d.detectadaEn === 'Prueba de traspaso')).toHaveLength(1);
    expect(m.traspaso.items['R-01']).toMatchObject({ coincide: 'No', correccion: 'Falta el umbral' });
  });

  it('los autores repiten una ronda en una sola mesa: vuelve a quedar abierta y sin respuestas', () => {
    const e = new Escenario(12);
    e.irA('a51');
    e.ok('leandro', 'lanzarRonda', { numero: 1 });
    for (const p of Object.keys(e.estado.mesas[1].miembros)) {
      e.ok(p, 'responderRonda', { numero: 1, itemId: 'guia', texto: 'x' });
    }
    expect(e.estado.mesas[1].rondas[0].reveladaEn).toBeDefined();
    expect(e.ejecutar('leandro', 'repetirRonda', { mesa: 1, numero: 1 })).toEqual({ ok: false, error: 'Solo los autores pueden hacer esto' });
    expect(e.ejecutar('autores', 'repetirRonda', { mesa: 1, numero: 2 })).toEqual({ ok: false, error: 'Esa ronda todavía no se lanzó en esa mesa' });
    e.ok('autores', 'repetirRonda', { mesa: 1, numero: 1 });
    const r = e.estado.mesas[1].rondas[0];
    expect(r.reveladaEn).toBeUndefined();
    expect(r.respuestas).toEqual({});
    expect(e.estado.mesas[2].rondas[0].respuestas.guia).toBeUndefined();
    e.irA('a52');
    expect(e.ejecutar('autores', 'repetirRonda', { mesa: 1, numero: 1 })).toEqual({
      ok: false, error: 'La ronda se repite en A5.1; para hacerlo después, reabre A5.1 en esa mesa',
    });
  });

  it('avanzarTramo después de cerrar la inscripción inicia el tramo 0, y antes no', () => {
    const sinCerrar = new Escenario(6, undefined, false);
    expect(sinCerrar.ejecutar('leandro', 'avanzarTramo')).toEqual({ ok: false, error: 'Primero cierra la inscripción y reparte los roles' });
    const e = new Escenario();
    e.ok('leandro', 'avanzarTramo');
    expect(e.estado).toMatchObject({ estado: 'en_curso', tramoIndice: 0 });
    e.irA('destape');
    e.ok('leandro', 'avanzarTramo');
    expect(e.estado.estado).toBe('cerrada');
    expect(e.ejecutar('leandro', 'avanzarTramo')).toEqual({ ok: false, error: 'La sesión ya terminó' });
  });

  it('avanzar o retroceder con un «desde» que ya no es el tramo actual se rechaza: un doble clic no salta un tramo', () => {
    const e = new Escenario();
    e.ok('leandro', 'avanzarTramo', { desde: null });
    expect(e.estado.tramoIndice).toBe(0);
    const viejo = e.ejecutar('leandro', 'avanzarTramo', { desde: null });
    expect(viejo).toEqual({ ok: false, error: 'El tramo ya cambió; mira la pantalla antes de volver a avanzar' });
    e.ok('leandro', 'avanzarTramo', { desde: 0 });
    expect(e.estado.tramoIndice).toBe(1);
    expect(e.ejecutar('autores', 'retrocederTramo', { desde: 0 }).ok).toBe(false);
    e.ok('autores', 'retrocederTramo', { desde: 1 });
    expect(e.estado.tramoIndice).toBe(0);
  });

  it('un comando desconocido se rechaza', () => {
    const e = new Escenario();
    expect(e.ejecutar('leandro', 'borrarTodo' as never)).toEqual({ ok: false, error: 'Comando desconocido' });
  });
});

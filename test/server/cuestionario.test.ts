import { esquemasComando } from '../../src/shared/comandos.js';
import { contenidoMinimo } from '../fixtures/contenido.js';
import { Escenario } from '../fixtures/escenario.js';

const respuestas = { problema: 5, terminos: 4, requisitos: 3, diferencias: 2 };
const original = { afirmaciones: [1, 2, 3, 4, 5], tlx: [50, 50, 50, 50, 50, 50], abierta: '' };
function escenario(nuevo: boolean) {
  const contenido = contenidoMinimo();
  if (nuevo) contenido.cuestionario.utilidad = { items: Object.keys(respuestas).map((id) => ({ id, texto: id })), abierta: '¿Qué ayudó?' };
  const e = new Escenario(6, contenido);
  e.aplicar({ en: e.ahora, por: { tipo: 'sistema' }, tipo: 'sesion.cerrada', datos: {} });
  return e;
}

describe('cuestionario y compatibilidad', () => {
  it('guarda utilidad con IDs estables y conserva cinco afirmaciones y seis escalas', () => {
    const e = escenario(true);
    const utilidad = { respuestas, abierta: 'Comparamos qué significaba guía' };
    e.ok(e.quien('PO'), 'responderCuestionario', { ...original, utilidad });
    expect(e.estado.cuestionario[e.quien('PO')]).toEqual({ ...original, utilidad });
  });

  it.each([
    undefined,
    { respuestas: { problema: 4 }, abierta: '' },
    { respuestas: { ...respuestas, inventada: 4 }, abierta: '' },
    { respuestas: { ...respuestas, diferencias: 0 }, abierta: '' },
    { respuestas: { ...respuestas, diferencias: 6 }, abierta: '' },
    { respuestas: { ...respuestas, diferencias: 2.5 }, abierta: '' },
  ])('rechaza utilidad ausente, incompleta, ajena o fuera de escala: %j', (utilidad) => {
    const e = escenario(true);
    expect(e.ejecutar(e.quien('PO'), 'responderCuestionario', { ...original, ...(utilidad ? { utilidad } : {}) }).ok).toBe(false);
    expect(e.estado.cuestionario).toEqual({});
  });

  it('acepta cuestionarios antiguos sin utilidad y reproduce eventos antiguos sin inventarla', () => {
    const e = escenario(false);
    e.ok(e.quien('PO'), 'responderCuestionario', original);
    e.aplicar({ en: e.ahora, por: { tipo: 'sistema' }, tipo: 'cuestionario.respondido', datos: { participante: e.quien('SD'), ...original } });
    expect(e.estado.cuestionario[e.quien('PO')]).toEqual(original);
    expect(e.estado.cuestionario[e.quien('SD')]).toEqual(original);
    expect(e.ejecutar(e.quien('QA'), 'responderCuestionario', { ...original, utilidad: { respuestas, abierta: '' } }).ok).toBe(false);
  });

  it('acepta cero y 50 sin interacción en las seis barras y limita el texto adicional', () => {
    expect(esquemasComando.responderCuestionario.safeParse({ ...original, tlx: [0, 50, 100, 50, 50, 50] }).success).toBe(true);
    expect(esquemasComando.responderCuestionario.safeParse({ ...original, utilidad: { respuestas, abierta: 'x'.repeat(601) } }).success).toBe(false);
  });
});

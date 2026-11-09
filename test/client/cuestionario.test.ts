import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guardarCambios } from '../../src/client/cambios.js';
import { Contexto } from '../../src/client/contexto.js';
import { Cuestionario, EscalaCuestionario } from '../../src/client/componentes/Cuestionario.js';
import { cuestionarioCompleto, normalizarCuestionario, pasoCuestionarioCompleto, pasosCuestionario } from '../../src/client/cuestionario.js';
import { vistaJugador } from '../../src/shared/vistas.js';
import { contenidoMinimo } from '../fixtures/contenido.js';
import { Escenario } from '../fixtures/escenario.js';

const items = ['problema', 'terminos', 'requisitos', 'diferencias'].map((id) => ({ id, texto: id }));
function preguntas(nueva = true) {
  return { ...contenidoMinimo().cuestionario, ...(nueva ? { utilidad: { items, abierta: '¿Qué ayudó?' } } : {}) };
}

describe('cuestionario por pasos', () => {
  it('abre cuatro pasos para utilidad y conserva tres para el contenido antiguo', () => {
    expect(pasosCuestionario(preguntas())).toEqual(['experiencia', 'utilidad', 'carga', 'comentarios']);
    expect(pasosCuestionario(preguntas(false))).toEqual(['experiencia', 'carga', 'comentarios']);
  });

  it('las seis barras empiezan sin responder y el paso de carga exige tocarlas todas', () => {
    const p = preguntas();
    const d = normalizarCuestionario(p);
    expect(d.tlx).toEqual([null, null, null, null, null, null]);
    d.afirmaciones = [4, 3, 2, 5, 1];
    d.utilidad.respuestas = { problema: 4, terminos: 3, requisitos: 5, diferencias: 2 };
    expect(pasoCuestionarioCompleto('carga', p, d)).toBe(false);
    expect(cuestionarioCompleto(p, d)).toBe(false);
    d.tlx = [50, 0, 100, 25, 50, 55];
    expect(pasoCuestionarioCompleto('carga', p, d)).toBe(true);
    expect(cuestionarioCompleto(p, d)).toBe(true);
  });

  it('conserva el borrador, con sus ceros y las barras que faltan por responder', () => {
    const p = preguntas();
    const previo = { afirmaciones: [1, 2, 3, 4, 5], tlx: [null, 0, 100, 25, null, 50], abierta: 'Menos campos', paso: 2, utilidad: { respuestas: { problema: 2 }, abierta: 'Acordamos el riego' } };
    const d = normalizarCuestionario(p, previo);
    expect(d).toEqual(previo);
    expect(normalizarCuestionario(p, { ...previo, tlx: [7, 'x', 120, -5, 50, 0] }).tlx).toEqual([null, null, null, null, 50, 0]);
    expect(normalizarCuestionario(p, { ...d, paso: 1 }).utilidad).toEqual(d.utilidad);
    expect(normalizarCuestionario(p, { ...d, paso: 3 }).afirmaciones).toEqual(d.afirmaciones);
  });

  it('no acepta omitir utilidad y no la exige al contenido original', () => {
    const p = preguntas();
    const d = normalizarCuestionario(p, { afirmaciones: [1, 2, 3, 4, 5], tlx: [50, 50, 50, 50, 50, 50] });
    expect(pasoCuestionarioCompleto('experiencia', p, d)).toBe(true);
    expect(pasoCuestionarioCompleto('utilidad', p, d)).toBe(false);
    expect(cuestionarioCompleto(preguntas(false), d)).toBe(true);
  });

  it('muestra el valor elegido, incluido el cero, y avisa cuando una barra falta por responder', () => {
    for (const valor of [0, 50]) {
      const html = renderToStaticMarkup(createElement(EscalaCuestionario, { nombre: 'Demanda mental', descripcion: '¿Cuánto exigió?', bajo: 'Baja', alto: 'Alta', valor, onCambio() {} }));
      expect(html).toContain(`aria-valuetext="${valor} de 100"`);
      expect(html).toContain(`${valor} de 100</output>`);
      expect(html).not.toContain('Sin responder');
    }
    const html = renderToStaticMarkup(createElement(EscalaCuestionario, { nombre: 'Demanda mental', descripcion: '¿Cuánto exigió?', bajo: 'Baja', alto: 'Alta', valor: null, onCambio() {} }));
    expect(html).toContain('aria-valuetext="Sin responder"');
    expect(html).toContain('Sin responder</output>');
  });

  function cuestionarioCon(datos: object) {
    const e = new Escenario();
    e.aplicar({ en: e.ahora, por: { tipo: 'sistema' }, tipo: 'sesion.cerrada', datos: {} });
    const v = vistaJugador(e.estado, e.quien('PO'), e.ahora);
    return renderToStaticMarkup(createElement(Contexto.Provider, {
      value: { v, enviar: async () => ({ ok: true as const }), borradores: { leer: () => guardarCambios(datos), guardar() {}, borrar() {} } },
    }, createElement(Cuestionario)));
  }

  it('no deja enviar con barras sin responder, aunque un borrador antiguo llegue al último paso', () => {
    const html = cuestionarioCon({ afirmaciones: [1, 2, 3, 4, 5], tlx: [null, 0, null, null, null, null], abierta: '', paso: 2 });
    expect(html).toContain('Paso 3 de 3');
    expect(html).toContain('<button type="button" class="btn ok" disabled="">Enviar respuestas</button>');
    expect(html).toContain('seis barras');
  });

  it('deja enviar cuando todas las afirmaciones y las seis barras tienen respuesta', () => {
    const html = cuestionarioCon({ afirmaciones: [1, 2, 3, 4, 5], tlx: [50, 0, 100, 25, 50, 50], abierta: '', paso: 2 });
    expect(html).toContain('<button type="button" class="btn ok">Enviar respuestas</button>');
  });
});

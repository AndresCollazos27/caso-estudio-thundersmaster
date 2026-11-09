import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Contexto } from '../../src/client/contexto.js';
import { Traspaso } from '../../src/client/componentes/Traspaso.js';
import { vistaJugador } from '../../src/shared/vistas.js';
import type { Rol } from '../../src/shared/valores.js';
import { contenidoReal } from '../fixtures/contenido.js';
import { Escenario } from '../fixtures/escenario.js';

function traspasoPara(rol: Rol) {
  const e = new Escenario(6, contenidoReal());
  e.irA('a6');
  const v = vistaJugador(e.estado, e.quien(rol), e.ahora);
  return renderToStaticMarkup(createElement(Contexto.Provider, {
    value: { v, enviar: async () => ({ ok: true as const }), borradores: { leer: () => '', guardar() {}, borrar() {} } },
  }, createElement(Traspaso)));
}

describe('traspaso antes de que llegue la línea base', () => {
  it('el responsable de calidad sabe que la línea base de otra mesa llegará a su celular', () => {
    expect(traspasoPara('QA')).toContain('aparecerán aquí');
  });

  it('la responsable de decisión sabe que verá aquí lo que entendió otra mesa', () => {
    expect(traspasoPara('PO')).toContain('verás aquí');
  });

  it('los demás roles no ven avisos del traspaso', () => {
    expect(traspasoPara('AN')).toBe('');
  });
});

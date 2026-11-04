import { ayudasVisibles, colorRol, etiquetaRol, minutoActual, textoAhora } from '../../src/client/textos.js';
import type { VistaJugador, VistaSesion } from '../../src/shared/vistas.js';
import { contenidoReal } from '../fixtures/contenido.js';

const vista = (paraTodos: string, paraMi: string[]) => ({ ahora: { paraTodos, paraMi } }) as unknown as VistaJugador;

describe('textos del celular', () => {
  it('textoAhora une paraTodos con las instrucciones de cada rol propio', () => {
    expect(textoAhora(vista('Para todos', ['Como FR', 'Como RT']))).toEqual(['Como FR', 'Como RT', 'Para todos']);
    expect(textoAhora(vista('Igual', ['Igual']))).toEqual(['Igual']);
    expect(textoAhora(vista('Solo esto', []))).toEqual(['Solo esto']);
  });

  it('colorRol devuelve el color del contenido', () => {
    const roles = contenidoReal().roles;
    expect(colorRol(roles, 'PO')).toBe('#B3261E');
    expect(colorRol(roles, 'SD2')).toBe('#9A4A17');
    expect(colorRol({}, 'QA')).toBe('#5C6672');
  });

  it('minutoActual suma los tramos anteriores y lo que va del actual, según la velocidad', () => {
    const agenda = [6, 3, 2, 4, 13, 7, 10, 6, 2, 7].map((minutos, i) => ({ id: `t${i}`, nombre: '', minutos }));
    const s = { tramoIndice: 4, velocidad: 10, agenda } as unknown as VistaSesion;
    // A5.1 dura 13 minutos; a ×10 son 78 s. Quedan 66 s, así que van 12 s, que son 2 minutos del caso.
    expect(minutoActual(s, 66_000)).toBe(17);
    expect(minutoActual(s, -5_000)).toBe(28);
    expect(minutoActual({ ...s, tramoIndice: null }, 0)).toBe(0);
  });

  it('durante las dos mediciones no se ofrecen la carta, el glosario ni la ficha técnica', () => {
    const en = (tramo: string | null) => ({ sesion: { tramo } }) as unknown as VistaJugador;
    expect(ayudasVisibles(en('medicion_previa'))).toBe(false);
    expect(ayudasVisibles(en('medicion_posterior'))).toBe(false);
    expect(ayudasVisibles(en('a51'))).toBe(true);
    expect(ayudasVisibles(en(null))).toBe(true);
  });

  it('etiquetaRol usa la etiqueta del contenido y, si falta, el código del rol', () => {
    expect(etiquetaRol(contenidoReal().roles, 'PO')).toBe('PO · Lucía');
    expect(etiquetaRol({}, 'RT')).toBe('RT');
  });
});

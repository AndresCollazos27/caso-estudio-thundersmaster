import { ayudasVisibles, colorRol, etiquetaRol, minutoActual, textoAhora } from '../../src/client/textos.js';
import type { VistaJugador, VistaSesion } from '../../src/shared/vistas.js';
import { contenidoReal } from '../fixtures/contenido.js';

const vista = (paraTodos: string, paraMi: string[]) => ({ ahora: { paraTodos, paraMi } }) as unknown as VistaJugador;

describe('textos del celular', () => {
  it('textoAhora une paraTodos con las instrucciones de cada rol propio', () => {
    expect(textoAhora(vista('Para todos', ['Como FR', 'Como RT']))).toEqual(['Como facilitador', 'Como relator', 'Para todos']);
    expect(textoAhora(vista('Igual', ['Igual']))).toEqual(['Igual']);
    expect(textoAhora(vista('Solo esto', []))).toEqual(['Solo esto']);
  });

  it('después de enviar la medición o la encuesta, «Ahora» dice que ya respondió y qué sigue', () => {
    const base = { ahora: { paraTodos: 'Responde las cuatro preguntas.', paraMi: ['Responde solo.'] } };
    expect(textoAhora({ ...base, medicion: { respondida: true } } as unknown as VistaJugador))
      .toEqual(['Ya enviaste tus respuestas. Espera a que el profesor Leandro pase al siguiente paso.']);
    expect(textoAhora({ ...base, cuestionario: { respondido: true } } as unknown as VistaJugador))
      .toEqual(['Gracias por participar. Ya enviaste la encuesta.']);
    expect(textoAhora({ ...base, medicion: { respondida: false } } as unknown as VistaJugador))
      .toEqual(['Responde solo.', 'Responde las cuatro preguntas.']);
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

  it('durante las dos mediciones no se ofrece la barra general de ayudas', () => {
    const en = (tramo: string | null) => ({ sesion: { tramo } }) as unknown as VistaJugador;
    expect(ayudasVisibles(en('medicion_previa'))).toBe(false);
    expect(ayudasVisibles(en('medicion_posterior'))).toBe(false);
    expect(ayudasVisibles(en('a51'))).toBe(true);
    expect(ayudasVisibles(en(null))).toBe(true);
  });

  it('etiquetaRol muestra nombres completos incluso con etiquetas antiguas o faltantes', () => {
    const roles = contenidoReal().roles;
    roles.PO!.etiqueta = 'PO · Lucía';
    roles.SD2!.etiqueta = 'SD · Carmen';
    expect(etiquetaRol(roles, 'PO')).toBe('Responsable de decisión · Lucía');
    expect(etiquetaRol(roles, 'SD2')).toBe('Stakeholder de dominio · Carmen');
    expect(etiquetaRol({}, 'RT')).toBe('Relator o gestor de trazabilidad');
  });
});

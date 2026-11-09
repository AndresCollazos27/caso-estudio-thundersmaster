import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { cargarContenido, ErrorContenido } from '../../src/shared/contenido.js';

const minimo = readFileSync(new URL('../fixtures/contenido-minimo.yaml', import.meta.url), 'utf8');

function variante(cambiar: (d: any) => void): string {
  const d = parse(minimo);
  cambiar(d);
  return stringify(d);
}

function errorDe(texto: string): ErrorContenido {
  try {
    cargarContenido(texto);
  } catch (e) {
    if (e instanceof ErrorContenido) return e;
    throw e;
  }
  throw new Error('se esperaba un ErrorContenido');
}

describe('cargarContenido', () => {
  it('carga el contenido mínimo', () => {
    const c = cargarContenido(minimo);
    expect(c.caso.nombre).toBe('Tomatera');
    expect(c.agenda).toHaveLength(10);
    expect(c.rondas[0].items[0].tecnica).toBe('Paráfrasis cruzada');
    expect(c.protocolo).toBeUndefined();
    expect(c.cuestionario.utilidad).toBeUndefined();
  });

  it('acepta protocolo nuevo y rechaza IDs duplicados en utilidad', () => {
    const nuevo = variante((d) => {
      d.protocolo = { version: 2, cartaEnPrevia: true };
      d.cuestionario.utilidad = { items: [{ id: 'problema', texto: 'Comprendí el problema' }], abierta: '¿Qué ayudó?' };
    });
    expect(cargarContenido(nuevo).protocolo).toEqual({ version: 2, cartaEnPrevia: true });
    expect(errorDe(variante((d) => {
      d.cuestionario.utilidad = { items: [{ id: 'problema', texto: 'A' }, { id: 'problema', texto: 'B' }], abierta: '?' };
    })).ruta).toBe('cuestionario.utilidad.items');
  });

  it('rechaza una técnica que no está en TECNICA_I3', () => {
    const e = errorDe(variante((d) => { d.rondas[0].items[0].tecnica = 'Lluvia de ideas'; }));
    expect(e.ruta).toBe('rondas.0.items.0.tecnica');
    expect(e.message).toContain('rondas.0.items.0.tecnica');
  });

  it('rechaza agenda que no suma 60 minutos', () => {
    const e = errorDe(variante((d) => { d.agenda[0].minutos = 5; }));
    expect(e.message).toContain('La agenda suma 59 minutos; debe sumar 60');
  });

  it('rechaza un ítem de ronda cuyo término no está en el glosario semilla', () => {
    const e = errorDe(variante((d) => { d.rondas[1].items[0].termino = 'Chupón'; }));
    expect(e.message).toContain('«Chupón»');
    expect(e.message).toContain('glosario semilla');
  });

  it('rechaza una clave desconocida, como la que deja una coma sin comillas', () => {
    const e = errorDe(variante((d) => { d.medicion[0]['¿qué es una guía?'] = null; }));
    expect(e.ruta).toBe('medicion.0');
    expect(e.message).toContain('si el texto tiene comas, ponlo entre comillas');
  });

  it('informa la línea del YAML mal formado', () => {
    const e = errorDe('caso:\n  nombre: Tomatera\n  empresa: [sin cerrar\n');
    expect(e.linea).toBeGreaterThan(0);
  });
});

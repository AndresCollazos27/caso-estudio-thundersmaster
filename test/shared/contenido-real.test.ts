import { readFileSync } from 'node:fs';
import { cargarContenido, type Contenido } from '../../src/shared/contenido.js';
import { TRAMOS } from '../../src/shared/valores.js';

const ruta = new URL('../../content/caso-tomatera.yaml', import.meta.url);

function contenido(): Contenido {
  return cargarContenido(readFileSync(ruta, 'utf8'));
}

function textoCarta(c: Contenido, rol: 'PO' | 'SD' | 'SD2' | 'AN' | 'QA'): string {
  const carta = c.cartas[rol];
  return [carta.quienEres, ...carta.vienesAPedir, ...carta.dasPorHecho, carta.comoHablas ?? ''].join(' ');
}

describe('contenido del caso Tomatera', () => {
  it('el contenido del caso es válido', () => {
    expect(() => contenido()).not.toThrow();
  });

  it('cada divergencia T1 a T8 aparece en al menos dos cartas de PO, SD, AN o QA', () => {
    const c = contenido();
    const pistas: Record<string, [ 'PO' | 'SD' | 'AN' | 'QA', RegExp ][]> = {
      T1: [['PO', /bomba/], ['AN', /mide y avisa/]],
      T2: [['SD', /enero/], ['PO', /Argentina/], ['QA', /meses/]],
      T3: [['SD', /1 a 17/], ['PO', /10 °C/], ['QA', /umbral/]],
      T4: [['SD', /seca al tacto/], ['AN', /30 %/], ['QA', /marca 0 %/]],
      T5: [['PO', /guías/], ['AN', /tutoriales/]],
      T6: [['SD', /tutor/], ['QA', /tutor/]],
      T7: [['SD', /planteles/], ['AN', /plantel/], ['QA', /plantines/]],
      T8: [['SD', /sabor/], ['PO', /híbridos/]],
    };
    for (const [t, lista] of Object.entries(pistas)) {
      const encontradas = lista.filter(([rol, re]) => re.test(textoCarta(c, rol)));
      expect(encontradas.length, `${t} debe estar en al menos dos cartas`).toBeGreaterThanOrEqual(2);
      expect(encontradas.length, `${t}: faltan pistas`).toBe(lista.length);
    }
  });

  it('ninguna carta contiene la palabra «coger»', () => {
    const c = contenido();
    for (const rol of ['PO', 'SD', 'SD2', 'AN', 'QA'] as const) {
      expect(textoCarta(c, rol).toLowerCase()).not.toContain('coger');
    }
  });

  it('la matriz cubre los diez tramos para los seis roles y para Carmen (SD2)', () => {
    const c = contenido();
    expect(c.agenda.map((t) => t.id)).toEqual([...TRAMOS]);
    for (const tramo of c.agenda) {
      for (const rol of ['PO', 'SD', 'SD2', 'FR', 'AN', 'QA', 'RT'] as const) {
        expect(tramo.porRol[rol], `${tramo.id} · ${rol}`).toBeTruthy();
      }
    }
  });

  it('a Carmen nunca se le dice que es Paco, y en A4 no se le pide una versión que no puede enviar', () => {
    const c = contenido();
    for (const tramo of c.agenda) expect(tramo.porRol.SD2, tramo.id).not.toMatch(/vas a ser paco|eres paco|ficha técnica/i);
    const a4 = c.agenda.find((t) => t.id === 'a4')!;
    expect(a4.porRol.SD2).not.toMatch(/^Escribe/);
  });

  it('el glosario semilla tiene los cinco términos en «Tentativo»', () => {
    const c = contenido();
    expect(c.plantillas.glosario.map((g) => g.termino)).toEqual(['Guía', 'Plantel', 'Tutor', 'Sustrato seco', 'Temperatura óptima']);
    expect(new Set(c.plantillas.glosario.map((g) => g.estado))).toEqual(new Set(['Tentativo']));
  });
});

import { duracionTramoMs, formatoReloj, hitosVencidos, restanteMs, transcurridoTramoMs, type RelojSesion } from '../../src/shared/tiempo.js';
import { contenidoMinimo } from '../fixtures/contenido.js';

const c = contenidoMinimo();
const t0 = 1_800_000_000_000;
const enA51 = (cambios: Partial<RelojSesion> = {}): RelojSesion => ({
  tramoIndice: 4, tramoInicio: t0, pausadaEn: null, pausaAcumulada: 0, velocidad: 1, hitosHechos: [], ...cambios,
});

describe('tiempo', () => {
  it('duracionTramoMs usa los minutos de la agenda y la velocidad', () => {
    expect(duracionTramoMs(c, 4, 1)).toBe(780000);
    expect(duracionTramoMs(c, 4, 60)).toBe(13000);
  });

  it('restanteMs descuenta lo transcurrido', () => {
    expect(restanteMs(c, enA51(), t0 + 120000)).toBe(660000);
  });

  it('restanteMs no cuenta el tiempo en pausa', () => {
    const r = enA51({ pausadaEn: t0 + 60000 });
    expect(transcurridoTramoMs(r, t0 + 180000)).toBe(60000);
    expect(restanteMs(c, r, t0 + 180000)).toBe(720000);
  });

  it('restanteMs puede ser negativo cuando hay tiempo extra', () => {
    expect(restanteMs(c, enA51(), t0 + 790000)).toBe(-10000);
  });

  it('hitosVencidos da los hitos del tramo ya cumplidos y no hechos', () => {
    expect(hitosVencidos(c, enA51(), t0 + 180000)).toEqual(['ronda1']);
    expect(hitosVencidos(c, enA51({ hitosHechos: ['ronda1'] }), t0 + 180000)).toEqual([]);
    expect(hitosVencidos(c, enA51(), t0 + 179000)).toEqual([]);
  });

  it('formatoReloj muestra minutos y segundos', () => {
    expect(formatoReloj(660000)).toBe('11:00');
    expect(formatoReloj(-12000)).toBe('-0:12');
    expect(formatoReloj(0)).toBe('0:00');
    expect(formatoReloj(59500)).toBe('1:00');
  });
});

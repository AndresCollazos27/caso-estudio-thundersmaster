import type { Contenido } from './contenido.js';
import { TRAMOS } from './valores.js';

// Los campos de EstadoDeSesion que necesita el cronómetro.
export interface RelojSesion {
  tramoIndice: number | null;
  tramoInicio: number | null;
  pausadaEn: number | null;
  pausaAcumulada: number;
  velocidad: number;
  hitosHechos: string[];
}

const MINUTO = 60_000;

// Una ronda de sondeo se revela sola a los 60 segundos del caso (a la velocidad de la sesión).
export const ESPERA_RONDA_MS = 60_000;

export function duracionTramoMs(c: Contenido, i: number, velocidad: number): number {
  return (c.agenda[i].minutos * MINUTO) / velocidad;
}

export function transcurridoTramoMs(r: RelojSesion, ahora: number): number {
  if (r.tramoInicio === null) return 0;
  const fin = r.pausadaEn ?? ahora;
  return fin - r.tramoInicio - r.pausaAcumulada;
}

export function restanteMs(c: Contenido, r: RelojSesion, ahora: number): number {
  if (r.tramoIndice === null) return 0;
  return duracionTramoMs(c, r.tramoIndice, r.velocidad) - transcurridoTramoMs(r, ahora);
}

export function hitosVencidos(c: Contenido, r: RelojSesion, ahora: number): string[] {
  if (r.tramoIndice === null) return [];
  const tramo = TRAMOS[r.tramoIndice];
  const transcurrido = transcurridoTramoMs(r, ahora);
  return c.hitos
    .filter((h) => h.tramo === tramo && (h.minuto * MINUTO) / r.velocidad <= transcurrido && !r.hitosHechos.includes(h.id))
    .map((h) => h.id);
}

export function formatoReloj(ms: number): string {
  const segundos = Math.ceil(Math.abs(ms) / 1000);
  const signo = ms < 0 && segundos > 0 ? '-' : '';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${signo}${m}:${String(s).padStart(2, '0')}`;
}

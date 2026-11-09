import type { Contenido } from '../shared/contenido.js';
import type { RespuestaUtilidad } from '../shared/tipos.js';

type Preguntas = Contenido['cuestionario'];
export type PasoCuestionario = 'experiencia' | 'utilidad' | 'carga' | 'comentarios';
export interface BorradorCuestionario {
  afirmaciones: (number | null)[];
  // null: la persona todavía no tocó esa barra. NASA-TLX pide una marca deliberada en cada escala.
  tlx: (number | null)[];
  abierta: string;
  utilidad: RespuestaUtilidad;
  paso: number;
}

export const pasosCuestionario = (p: Preguntas): PasoCuestionario[] =>
  p.utilidad ? ['experiencia', 'utilidad', 'carga', 'comentarios'] : ['experiencia', 'carga', 'comentarios'];

const objeto = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const acuerdo = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5;
const carga = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 100 && x % 5 === 0;

// Recupera el borrador sin perder respuestas, ceros ni comentarios. Una barra sin tocar sigue sin respuesta:
// un valor inicial que se envía sin moverlo no se distingue de una respuesta pensada.
export function normalizarCuestionario(p: Preguntas, guardado: unknown = {}): BorradorCuestionario {
  const d = objeto(guardado);
  const afirmaciones = Array.isArray(d.afirmaciones) ? d.afirmaciones : [];
  const tlx = Array.isArray(d.tlx) ? d.tlx : [];
  const utilidad = objeto(d.utilidad);
  const respuestas = objeto(utilidad.respuestas);
  const paso = typeof d.paso === 'number' && Number.isInteger(d.paso) ? d.paso : 0;
  return {
    afirmaciones: p.afirmaciones.map((_, i) => acuerdo(afirmaciones[i]) ? afirmaciones[i] as number : null),
    tlx: p.tlx.map((_, i) => (carga(tlx[i]) ? tlx[i] : null)),
    abierta: typeof d.abierta === 'string' ? d.abierta : '',
    utilidad: {
      respuestas: Object.fromEntries((p.utilidad?.items ?? []).filter((item) => acuerdo(respuestas[item.id])).map((item) => [item.id, respuestas[item.id] as number])),
      abierta: typeof utilidad.abierta === 'string' ? utilidad.abierta : '',
    },
    paso: Math.max(0, Math.min(paso, pasosCuestionario(p).length - 1)),
  };
}

export function pasoCuestionarioCompleto(paso: PasoCuestionario, p: Preguntas, d: BorradorCuestionario): boolean {
  if (paso === 'experiencia') return d.afirmaciones.length === p.afirmaciones.length && d.afirmaciones.every(acuerdo);
  if (paso === 'utilidad') return (p.utilidad?.items ?? []).every((item) => acuerdo(d.utilidad.respuestas[item.id]));
  if (paso === 'carga') return d.tlx.length === p.tlx.length && d.tlx.every(carga);
  return true;
}

export function cuestionarioCompleto(p: Preguntas, d: BorradorCuestionario): boolean {
  return pasosCuestionario(p).every((paso) => pasoCuestionarioCompleto(paso, p, d));
}

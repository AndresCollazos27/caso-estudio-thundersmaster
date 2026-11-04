import type { TipoComando } from '../shared/comandos.js';
import type { Contenido } from '../shared/contenido.js';
import { puedeRol } from '../shared/permisos.js';
import type { Rol } from '../shared/valores.js';
import type { VistaJugador, VistaSesion } from '../shared/vistas.js';

const GRIS = '#5C6672';

// Primero lo que le toca a cada rol propio; al final, lo que vale para todos (si no es lo mismo).
export function textoAhora(v: VistaJugador): string[] {
  return [...new Set([...v.ahora.paraMi, v.ahora.paraTodos])];
}

export const colorRol = (roles: Contenido['roles'], r: Rol): string => roles[r]?.color ?? GRIS;

export const etiquetaRol = (roles: Contenido['roles'], r: Rol): string => roles[r]?.etiqueta ?? r;

// Si este celular puede mandar ese comando ahora; el servidor vuelve a comprobarlo.
export function puedo(v: VistaJugador, tipo: TipoComando): boolean {
  if (!v.mesa || v.yo.espectador) return false;
  return puedeRol(tipo, v.yo.roles, { estado: v.sesion.estado, tramo: v.sesion.tramo, reabiertos: v.mesa.reabiertos }).ok;
}

export const tiene = (v: VistaJugador, ...roles: Rol[]): boolean => v.yo.roles.some((r) => roles.includes(r));

// En la medición cada quien responde de memoria: sin carta, glosario ni ficha técnica a mano.
export const ayudasVisibles = (v: VistaJugador): boolean =>
  v.sesion.tramo !== 'medicion_previa' && v.sesion.tramo !== 'medicion_posterior';

// En qué minuto de los 60 del caso va la sesión, para la línea de tiempo de la pantalla de Leandro.
export function minutoActual(s: Pick<VistaSesion, 'tramoIndice' | 'velocidad' | 'agenda'>, restanteMs: number): number {
  if (s.tramoIndice === null) return 0;
  const antes = s.agenda.slice(0, s.tramoIndice).reduce((x, t) => x + t.minutos, 0);
  const duracion = s.agenda[s.tramoIndice].minutos;
  const transcurrido = duracion - (restanteMs * s.velocidad) / 60_000;
  return antes + Math.min(duracion, Math.max(0, transcurrido));
}

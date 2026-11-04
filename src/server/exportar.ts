import { createHash } from 'node:crypto';
import type { Contenido } from '../shared/contenido.js';
import type { Evento } from '../shared/eventos.js';
import { lecturasMesa, type LecturasMesa } from '../shared/lecturas.js';
import type { EstadoDeSesion, Mesa } from '../shared/tipos.js';
import type { Rol } from '../shared/valores.js';

export interface Exportacion {
  sesion: { id: string; codigo: string; prueba: boolean; creadaEn: number; contenidoVersion: string };
  participantes: { id: string; mesa: number | null; roles: Rol[]; bot: boolean; espectador: boolean }[];
  mesas: (Mesa & { lecturas: LecturasMesa })[];
  medicion: EstadoDeSesion['medicion'];
  cuestionario: EstadoDeSesion['cuestionario'];
  entrevista: EstadoDeSesion['entrevista'];
  eventos: Evento[];
  contenido: Contenido;
}

// El apodo y la clave de cada celular quedan en el servidor: se quitan en cualquier nivel, también del evento
// con el que cada persona se unió.
const PRIVADOS = new Set(['apodo', 'clave']);
function sinApodo<T>(x: T): T {
  return JSON.parse(JSON.stringify(x, (k, valor) => (PRIVADOS.has(k) ? undefined : valor)));
}

export function exportarSesion(estado: EstadoDeSesion, eventos: Evento[]): Exportacion {
  return sinApodo({
    sesion: {
      id: estado.id, codigo: estado.codigo, prueba: estado.prueba, creadaEn: estado.creadaEn,
      // Identifica qué contenido se usó, para no mezclar exportaciones de versiones distintas del YAML.
      contenidoVersion: createHash('sha256').update(JSON.stringify(estado.contenido)).digest('hex').slice(0, 12),
    },
    participantes: Object.values(estado.participantes).map((p) => ({
      id: p.id, mesa: p.mesa, roles: p.roles, bot: p.bot, espectador: p.espectador,
    })),
    mesas: Object.values(estado.mesas).sort((a, b) => a.numero - b.numero).map((m) => ({ ...m, lecturas: lecturasMesa(m) })),
    medicion: estado.medicion,
    cuestionario: estado.cuestionario,
    entrevista: estado.entrevista,
    eventos,
    contenido: estado.contenido,
  });
}

const dos = (n: number) => String(n).padStart(2, '0');

// Con la hora local del servidor (la variable TZ).
export function nombreExportacion(codigo: string, fecha: Date): string {
  const dia = `${fecha.getFullYear()}${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}`;
  return `tomatera-${codigo}-${dia}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}.json`;
}

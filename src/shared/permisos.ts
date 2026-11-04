import type { TipoComando } from './comandos.js';
import type { Actor } from './eventos.js';
import type { EstadoDeSesion, EstadoSesion } from './tipos.js';
import { TRAMOS, type Rol, type TramoId } from './valores.js';

type Quien = 'leandro' | 'autores' | 'participantes' | Rol;

interface Regla {
  actores: Quien[];
  tramos: TramoId[] | 'siempre' | 'cerrada';
  // Por defecto SD2 (Carmen) tiene los permisos del SD; aquí se le quitan.
  sinSD2?: true;
}

const DESDE_A4: TramoId[] = ['a4', 'a51', 'a52', 'a53', 'a6'];
const CONDUCCION: Quien[] = ['leandro', 'autores'];

export const PERMISOS: Record<TipoComando, Regla> = {
  leerCarta: { actores: ['participantes'], tramos: 'siempre' },
  pedirFicha: { actores: ['participantes'], tramos: 'siempre' },
  responderMedicion: { actores: ['participantes'], tramos: ['medicion_previa', 'medicion_posterior'] },
  escribirVersion: { actores: ['PO', 'SD', 'AN'], tramos: ['a4'], sinSD2: true },
  marcarEquivalencia: { actores: ['FR'], tramos: ['a4'] },
  guardarAjustes: { actores: ['FR'], tramos: ['a4'] },
  guardarTermino: { actores: ['AN', 'QA', 'RT'], tramos: ['a51', 'a52', 'a53'] },
  guardarNecesidad: { actores: ['AN', 'RT'], tramos: ['a51'] },
  responderRonda: { actores: ['participantes'], tramos: ['a51'] },
  marcarRonda: { actores: ['FR'], tramos: ['a51'] },
  cambiarItemRonda: { actores: ['FR'], tramos: ['a51'] },
  marcarChequeos: { actores: ['FR'], tramos: ['a51'] },
  guardarTarjeta: { actores: ['AN', 'QA', 'FR'], tramos: ['a52'] },
  marcarI2A: { actores: ['QA', 'AN'], tramos: ['a52'] },
  // En A5.2 para las necesidades de prioridad alta; en A5.3, para el crítico que todavía no lo tenga (columna H de I2).
  escribirEsperado: { actores: ['PO', 'SD', 'SD2'], tramos: ['a52', 'a53'] },
  marcarI2B: { actores: ['AN', 'QA'], tramos: ['a53'] },
  marcarI2C: { actores: ['PO', 'SD', 'FR'], tramos: ['a53'] },
  guardarDivergencia: { actores: ['RT', 'FR'], tramos: DESDE_A4 },
  guardarValidacion06: { actores: ['RT'], tramos: ['a53'] },
  congelarLineaBase: { actores: ['RT'], tramos: ['a6'] },
  marcarEvidencia: { actores: ['FR'], tramos: ['a6'] },
  reconstruir: { actores: ['QA'], tramos: ['a6'] },
  confirmarTraspaso: { actores: ['PO'], tramos: ['a6'] },
  guardarAccion: { actores: ['RT'], tramos: ['a6'] },
  marcarDestape: { actores: ['FR'], tramos: ['destape'] },
  responderCuestionario: { actores: ['participantes'], tramos: 'cerrada' },
  cerrarInscripcion: { actores: CONDUCCION, tramos: 'siempre' },
  avanzarTramo: { actores: CONDUCCION, tramos: 'siempre' },
  lanzarRonda: { actores: CONDUCCION, tramos: 'siempre' },
  pausar: { actores: CONDUCCION, tramos: 'siempre' },
  reanudar: { actores: CONDUCCION, tramos: 'siempre' },
  notaEntrevista: { actores: CONDUCCION, tramos: 'siempre' },
  retrocederTramo: { actores: ['autores'], tramos: 'siempre' },
  moverParticipante: { actores: ['autores'], tramos: 'siempre' },
  reabrirPlantilla: { actores: ['autores'], tramos: 'siempre' },
  repetirRonda: { actores: ['autores'], tramos: 'siempre' },
  cambiarAvance: { actores: ['autores'], tramos: 'siempre' },
};

export const NO_PUEDE = 'Tu rol no puede hacer esto en este tramo';

export function rolesEfectivos(roles: Rol[], regla: Pick<Regla, 'sinSD2'>): Rol[] {
  if (regla.sinSD2 || !roles.includes('SD2')) return roles;
  return [...roles, 'SD'];
}

// La inscripción se cierra al repartir las mesas; el estado pasa a «en_curso» recién con el primer tramo.
export function inscripcionCerrada(estado: EstadoDeSesion): boolean {
  return Object.keys(estado.mesas).length > 0;
}

export function tramoActual(estado: EstadoDeSesion): TramoId | null {
  return estado.tramoIndice === null ? null : TRAMOS[estado.tramoIndice];
}

export function puede(estado: EstadoDeSesion, actor: Actor, tipo: TipoComando): { ok: true } | { ok: false; motivo: string } {
  const regla = PERMISOS[tipo];
  if (actor.tipo === 'sistema') return { ok: true };
  if (actor.tipo === 'leandro' || actor.tipo === 'autores') {
    if (regla.actores.includes(actor.tipo)) return { ok: true };
    const motivo = regla.actores.includes('autores') && !regla.actores.includes('leandro')
      ? 'Solo los autores pueden hacer esto'
      : 'Esto lo hacen los participantes desde su celular';
    return { ok: false, motivo };
  }

  const p = estado.participantes[actor.id];
  if (!p) return { ok: false, motivo: 'No estás en esta sesión' };
  if (p.espectador) return { ok: false, motivo: 'Como espectador puedes mirar, pero no participar' };
  if (p.mesa === null) return { ok: false, motivo: 'Espera a que se armen las mesas' };
  return puedeRol(tipo, p.roles, { estado: estado.estado, tramo: tramoActual(estado), reabiertos: estado.mesas[p.mesa]?.reabiertos ?? [] });
}

// La misma regla la usa el celular, con lo que trae su vista, para mostrar solo lo que el rol puede hacer.
export function puedeRol(
  tipo: TipoComando, rolesPropios: Rol[], c: { estado: EstadoSesion; tramo: TramoId | null; reabiertos: TramoId[] },
): { ok: true } | { ok: false; motivo: string } {
  const regla = PERMISOS[tipo];
  const esDeParticipantes = regla.actores.includes('participantes');
  const roles = rolesEfectivos(rolesPropios, regla);
  if (!esDeParticipantes && !roles.some((r) => regla.actores.includes(r))) return { ok: false, motivo: NO_PUEDE };

  if (regla.tramos === 'siempre') return { ok: true };
  if (regla.tramos === 'cerrada') {
    return c.estado === 'cerrada' ? { ok: true } : { ok: false, motivo: 'El cuestionario se abre al terminar la sesión' };
  }
  if (c.estado !== 'en_curso') return { ok: false, motivo: 'La sesión todavía no empezó' };
  const permitido = (t: TramoId) => (regla.tramos as TramoId[]).includes(t);
  if ((c.tramo && permitido(c.tramo)) || c.reabiertos.some(permitido)) return { ok: true };
  return { ok: false, motivo: NO_PUEDE };
}

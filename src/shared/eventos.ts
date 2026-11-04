import type { Contenido } from './contenido.js';
import type { Divergencia, Evidencia, ItemRonda, Necesidad, PerfilApertura, Tarjeta, Termino } from './tipos.js';
import type { Conformidad, ResultadoI3, RevisionI2A, Rol, SiNo, SiNoPend, TramoId } from './valores.js';

export type Actor =
  | { tipo: 'participante'; id: string; roles: Rol[] }
  | { tipo: 'leandro' }
  | { tipo: 'autores' }
  | { tipo: 'sistema' };

export type NumeroRonda = 1 | 2;

export interface DatosEvento {
  'sesion.creada': { id: string; codigo: string; prueba: boolean; velocidad: number; contenido: Contenido };
  // `clave` es el secreto con el que ese celular vuelve a entrar; no sale en ninguna vista ni en la exportación.
  'participante.unido': { id: string; apodo?: string; bot: boolean; mesa?: number | null; roles?: Rol[]; espectador?: boolean; clave?: string };
  'inscripcion.cerrada': { mesas: { numero: number; miembros: Record<string, Rol[]> }[]; espectadores: string[] };
  'participante.movido': { id: string; mesa: number | null; roles: Rol[]; espectador?: boolean };
  'tramo.iniciado': { indice: number };
  'cronometro.pausado': Record<string, never>;
  'cronometro.reanudado': Record<string, never>;
  'avance.cambiado': { automatico: boolean };
  'hito.hecho': { id: string };
  'carta.leida': { participante: string };
  'ficha.pedida': { participante: string };
  'medicion.respondida': { participante: string; fase: 'previa' | 'posterior'; respuestas: string[] };
  'apertura.version': { perfil: PerfilApertura; texto: string; participante: string };
  'apertura.marca': { perfil: PerfilApertura; valor: SiNo };
  'apertura.ajustes': { texto: string };
  'termino.guardado': { termino: Termino };
  'necesidad.guardada': { necesidad: Necesidad };
  'tarjeta.guardada': { tarjeta: Tarjeta };
  'i2a.marcada': { tarjetaId: string; revision: RevisionI2A; nota: string };
  'i2b.marcada': { campo: 'B1' | 'B2'; valor: SiNoPend; obs: string };
  'esperado.escrito': { necesidadId: string; texto: string };
  'i2c.marcada': { tarjetaId: string; campo: 'C1' | 'C2' | 'C3'; valor: SiNoPend; divergenciaId?: string };
  'divergencia.guardada': { divergencia: Divergencia };
  'validacion06.guardada': { conjunto: string; fechaParticipantes: string; tecnica: string; conformidad?: Conformidad; constancia: string };
  'ronda.lanzada': { numero: NumeroRonda };
  'ronda.item.cambiado': { numero: NumeroRonda; itemId: string; item: ItemRonda };
  'ronda.respondida': { numero: NumeroRonda; itemId: string; participante: string; texto: string };
  'ronda.revelada': { numero: NumeroRonda };
  'ronda.repetida': { numero: NumeroRonda };
  'ronda.marcada': { numero: NumeroRonda; itemId: string; resultado: ResultadoI3; divergenciaId?: string; participante: string };
  'chequeos.marcados': { c5?: SiNoPend; c6?: SiNoPend; obs: string };
  'lineabase.congelada': { por: string };
  'evidencia.marcada': { evidencia: Evidencia; resultado: SiNoPend; nota: string };
  'traspaso.asignado': { lectorId: string | null; lectorMesa: number | null };
  'traspaso.reconstruido': { tarjetaId: string; texto: string };
  'traspaso.confirmado': { tarjetaId: string; coincide: SiNo; correccion: string };
  'accion.guardada': { indice?: number; accion: { origen: string; accion: string; responsable: string; fecha: string } };
  'destape.marcado': { divergencia: string; registrada: boolean };
  'cuestionario.respondido': { participante: string; afirmaciones: number[]; tlx: number[]; abierta: string };
  'entrevista.nota': { pregunta: number; texto: string };
  'plantilla.reabierta': { tramo: TramoId };
  'sesion.cerrada': Record<string, never>;
  conexion: { participante: string; conectado: boolean };
}

export type TipoEvento = keyof DatosEvento;

export type Evento = {
  [K in TipoEvento]: { seq: number; en: number; tipo: K; por: Actor; mesa?: number; opId?: string; datos: DatosEvento[K] };
}[TipoEvento];

export type EventoSinSeq = Evento extends infer E ? (E extends unknown ? Omit<E, 'seq'> : never) : never;

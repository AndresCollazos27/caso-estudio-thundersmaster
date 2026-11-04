import { z } from 'zod';
import {
  CONFORMIDAD, DETECTADA_EN, ESTADO_DIVERGENCIA, ESTADO_NECESIDAD, ESTADO_TERMINO, MAX_TEXTO, PRIORIDAD, RESULTADO_I3,
  REVISION_I2A, ROLES, SI_NO, SI_NO_PEND, TECNICA_I3, TIPO_REQUISITO, TRAMOS,
} from './valores.js';

// Esquemas compartidos por el servidor (que valida) y el cliente (que arma los comandos).
// Los campos opcionales no tienen valor por defecto: al editar, lo que no llega no se pisa.
const texto = z.string().max(MAX_TEXTO, `El texto pasa de ${MAX_TEXTO} caracteres`);
const conTexto = texto.trim().min(1, 'No puede estar vacío');
const numeroRonda = z.union([z.literal(1), z.literal(2)]);
const id = z.string().min(1).max(20);
const vacio = z.object({}).strict();
const obj = <T extends z.ZodRawShape>(forma: T) => z.object(forma).strict();

export const esquemasComando = {
  leerCarta: vacio,
  pedirFicha: vacio,
  responderMedicion: obj({ fase: z.enum(['previa', 'posterior']), respuestas: z.array(texto).length(4) }),
  escribirVersion: obj({ texto: conTexto }),
  marcarEquivalencia: obj({ perfil: z.enum(['PO', 'SD', 'AN']), valor: z.enum(SI_NO) }),
  guardarAjustes: obj({ texto }),
  guardarTermino: obj({
    id: id.optional(), termino: conTexto.optional(), definicion: texto.optional(), ejemplo: texto.optional(),
    critico: z.enum(SI_NO).optional(), estado: z.enum(ESTADO_TERMINO).optional(), responsable: texto.optional(),
  }),
  guardarNecesidad: obj({
    id: id.optional(), bloque: z.number().int().positive().optional(), necesidad: conTexto.optional(), fuente: texto.optional(),
    contextoValor: texto.optional(), supuestos: texto.optional(), prioridad: z.enum(PRIORIDAD).optional(),
    estado: z.enum(ESTADO_NECESIDAD).optional(),
  }),
  responderRonda: obj({ numero: numeroRonda, itemId: id, texto: conTexto }),
  marcarRonda: obj({ numero: numeroRonda, itemId: id, resultado: z.enum(RESULTADO_I3) }),
  cambiarItemRonda: obj({ numero: numeroRonda, itemId: id, termino: conTexto, tecnica: z.enum(TECNICA_I3), pregunta: conTexto }),
  marcarChequeos: obj({ c5: z.enum(SI_NO_PEND).optional(), c6: z.enum(SI_NO_PEND).optional(), obs: texto.optional() }),
  guardarTarjeta: obj({
    id: id.optional(), necesidadId: id.optional(), tipo: z.enum(TIPO_REQUISITO).optional(), enunciado: conTexto.optional(),
    critico: z.enum(SI_NO).optional(), criterioEjemplo: texto.optional(), prioridad: z.enum(PRIORIDAD).optional(),
    restriccion: texto.optional(), acepta: texto.optional(),
  }),
  marcarI2A: obj({ tarjetaId: id, revision: z.enum(REVISION_I2A), nota: texto.optional() }),
  escribirEsperado: obj({ necesidadId: id, texto }),
  marcarI2B: obj({ campo: z.enum(['B1', 'B2']), valor: z.enum(SI_NO_PEND), obs: texto.optional() }),
  marcarI2C: obj({ tarjetaId: id, campo: z.enum(['C1', 'C2', 'C3']), valor: z.enum(SI_NO_PEND) }),
  guardarDivergencia: obj({
    id: id.optional(), detectadaEn: z.enum(DETECTADA_EN).optional(), afectaA: texto.optional(), descripcion: conTexto.optional(),
    resolucion: texto.optional(), estado: z.enum(ESTADO_DIVERGENCIA).optional(), responsable: texto.optional(),
    fechaLimite: texto.optional(),
  }),
  guardarValidacion06: obj({
    conjunto: texto.optional(), fechaParticipantes: texto.optional(), tecnica: texto.optional(),
    conformidad: z.enum(CONFORMIDAD).optional(), constancia: texto.optional(),
  }),
  congelarLineaBase: vacio,
  marcarEvidencia: obj({ evidencia: z.enum(['E1', 'E2', 'E3', 'E4', 'E5']), resultado: z.enum(SI_NO_PEND), nota: texto.optional() }),
  reconstruir: obj({ tarjetaId: id, texto: conTexto }),
  confirmarTraspaso: obj({ tarjetaId: id, coincide: z.enum(SI_NO), correccion: texto.optional() }),
  guardarAccion: obj({ indice: z.number().int().nonnegative().optional(), origen: texto, accion: conTexto, responsable: texto, fecha: texto }),
  marcarDestape: obj({ divergencia: z.string().regex(/^T[1-8]$/), registrada: z.boolean() }),
  responderCuestionario: obj({
    afirmaciones: z.array(z.number().int().min(1).max(5)).length(5),
    tlx: z.array(z.number().int().min(0).max(100).multipleOf(5)).length(6),
    abierta: texto,
  }),
  cerrarInscripcion: vacio,
  // `desde` es el tramo que veía quien apretó el botón: si ya cambió, el comando se rechaza.
  avanzarTramo: obj({ desde: z.number().int().nonnegative().nullable().optional() }),
  lanzarRonda: obj({ numero: numeroRonda }),
  pausar: vacio,
  reanudar: vacio,
  notaEntrevista: obj({ pregunta: z.number().int().min(1).max(3), texto }),
  retrocederTramo: obj({ desde: z.number().int().nonnegative().nullable().optional() }),
  moverParticipante: obj({
    participanteId: id.or(z.string().min(1).max(40)), mesa: z.number().int().positive().nullable(),
    roles: z.array(z.enum(ROLES)), espectador: z.boolean().optional(),
  }),
  reabrirPlantilla: obj({ mesa: z.number().int().positive(), tramo: z.enum(TRAMOS) }),
  repetirRonda: obj({ mesa: z.number().int().positive(), numero: numeroRonda }),
  cambiarAvance: obj({ automatico: z.boolean() }),
} as const;

export type TipoComando = keyof typeof esquemasComando;
export type DatosComando<K extends TipoComando> = z.input<(typeof esquemasComando)[K]>;

export interface Comando {
  opId: string;
  tipo: TipoComando;
  datos: unknown;
}

export function esTipoComando(tipo: string): tipo is TipoComando {
  return Object.prototype.hasOwnProperty.call(esquemasComando, tipo);
}

// Mensaje en español, nombrando el campo que falló.
export function mensajeDeValidacion(error: z.ZodError): string {
  const issue = error.issues[0];
  const campo = issue.path.length > 0 ? `«${issue.path.join('.')}»` : 'el comando';
  if (issue.code === 'invalid_enum_value') return `El campo ${campo} debe ser uno de: ${issue.options.join(', ')}`;
  if (issue.code === 'unrecognized_keys') return `El comando trae campos que no conoce: ${issue.keys.join(', ')}`;
  if (issue.code === 'invalid_type') return `Falta el campo ${campo} o tiene un tipo incorrecto`;
  return `El campo ${campo} no es válido: ${issue.message}`;
}

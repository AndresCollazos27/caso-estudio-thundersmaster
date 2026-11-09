// Lo que recibe cada cliente. Nunca se manda el contenido completo: trae las cartas de todos los roles.
import type { Contenido } from './contenido.js';
import {
  filaI2C, lecturasMesa, mesaQueLee, muestraTraspaso, resultadoFilaI2C, tarjetasCriticas, type LecturasMesa, type ResultadoI2C,
} from './lecturas.js';
import { inscripcionCerrada, tramoActual } from './permisos.js';
import { ESPERA_RONDA_MS, restanteMs } from './tiempo.js';
import type { EstadoDeSesion, EstadoSesion, FilaI2C, ItemRonda, Mesa, ResultadoRonda, Tarjeta } from './tipos.js';
import type { Rol, TramoId } from './valores.js';

type Carta = Contenido['cartas']['PO'];

export interface VistaSesion {
  id: string;
  codigo: string;
  estado: EstadoSesion;
  inscripcionCerrada: boolean;
  tramo: TramoId | null;
  tramoIndice: number | null;
  nombreTramo: string;
  restanteMs: number;
  pausada: boolean;
  ahoraServidor: number;
  agenda: { id: TramoId; nombre: string; minutos: number }[];
  hitosHechos: string[];
  prueba: boolean;
  velocidad: number;
}

export interface VistaRonda {
  numero: 1 | 2;
  // Cambia si los autores repiten la ronda.
  lanzadaEn: number;
  items: ItemRonda[];
  revelada: boolean;
  misRespuestas: Record<string, string>;
  respondieron: Record<string, number>;
  total: number;
  respuestas: Record<string, { participante: string; roles: Rol[]; texto: string }[]> | null;
  resultados: Record<string, ResultadoRonda>;
}

export interface VistaMesa extends Omit<Mesa, 'rondas' | 'traspaso' | 'i2c'> {
  integrantes: { id: string; apodo?: string; roles: Rol[]; conectado: boolean }[];
  rondas: VistaRonda[];
  i2c: Record<string, FilaI2C & { resultado: ResultadoI2C }>;
}

export interface VistaJugador {
  tipo: 'jugador';
  yo: { id: string; apodo?: string; mesa: number | null; roles: Rol[]; espectador: boolean; cartaLeida: boolean };
  sesion: VistaSesion;
  ahora: { paraTodos: string; paraMi: string[] };
  roles: Contenido['roles'];
  carta: Carta | null;
  hojas: string[];
  contexto: Pick<Contenido['plantillas'], 'canvas' | 'mapa' | 'chequeoSuficiencia' | 'declaracion'> | null;
  mesa: VistaMesa | null;
  lecturas: LecturasMesa | null;
  traspaso: {
    comoLector: { mesa: number; tarjetas: Tarjeta[]; mias: Record<string, string> } | null;
    comoPO: Record<string, { reconstruccion: string; coincide?: 'Sí' | 'No'; correccion: string }> | null;
  };
  medicion: { fase: 'previa' | 'posterior'; preguntas: Contenido['medicion']; respondida: boolean; permiteCarta: boolean } | null;
  destape: Contenido['destape'] | null;
  cuestionario: { preguntas: Contenido['cuestionario']; respondido: boolean } | null;
  fichaTecnica: Contenido['fichaTecnica'] | null;
}

export interface ResumenMesa {
  numero: number;
  personas: number;
  conectados: number;
  necesidades: number;
  terminos: number;
  tarjetas: number;
  divergencias: number;
  congelada: boolean;
  medicion?: { respondieron: number; total: number };
  cuestionario?: { respondieron: number; total: number };
  // terminaEn: hora del servidor en que la ronda se revela sola, para la cuenta de 60 segundos proyectada.
  ronda: { numero: 1 | 2; respondieron: number; total: number; revelada: boolean; terminaEn: number } | null;
}

export interface VistaLeandro {
  tipo: 'leandro';
  sesion: VistaSesion;
  enlace: string;
  paraTodos: string;
  conectados: number;
  inscritos: number;
  mesas: ResumenMesa[];
  rondasLanzadas: number[];
  destape: Contenido['destape'] | null;
  entrevista: { preguntas: string[]; notas: EstadoDeSesion['entrevista'] } | null;
  cuestionario?: { afirmaciones: number; utilidad: number; tlx: number; comentarios: number };
}

export interface VistaAutores {
  tipo: 'autores';
  sesion: VistaSesion;
  estado: EstadoDeSesion;
  lecturas: Record<number, LecturasMesa>;
}

function vistaSesion(e: EstadoDeSesion, ahora: number): VistaSesion {
  const tramo = tramoActual(e);
  return {
    id: e.id, codigo: e.codigo, estado: e.estado, inscripcionCerrada: inscripcionCerrada(e), tramo, tramoIndice: e.tramoIndice,
    nombreTramo: tramo ? e.contenido.agenda[e.tramoIndice as number].nombre : 'Inscripción',
    restanteMs: restanteMs(e.contenido, e, ahora), pausada: e.pausadaEn !== null, ahoraServidor: ahora,
    agenda: e.contenido.agenda.map((t) => ({ id: t.id, nombre: t.nombre, minutos: t.minutos })),
    hitosHechos: [...e.hitosHechos], prueba: e.prueba, velocidad: e.velocidad,
  };
}

function paraTodos(e: EstadoDeSesion): string {
  if (e.tramoIndice === null) return inscripcionCerrada(e) ? 'Busca tu mesa. Espera a que el profesor Leandro inicie la actividad.' : 'Escanea el QR para unirte.';
  if (e.estado === 'cerrada') return 'Gracias por participar. Responde el cuestionario en tu celular.';
  return e.contenido.agenda[e.tramoIndice].paraTodos;
}

function instruccionesDe(e: EstadoDeSesion, roles: Rol[]): string[] {
  if (e.tramoIndice === null || e.estado === 'cerrada') return [];
  const tramo = e.contenido.agenda[e.tramoIndice];
  const textos = roles.map((r) => tramo.porRol[r] ?? (r === 'SD2' ? tramo.porRol.SD : undefined) ?? tramo.paraTodos);
  return [...new Set(textos)];
}

function vistaRonda(m: Mesa, r: Mesa['rondas'][number], yo: string): VistaRonda {
  const revelada = r.reveladaEn !== undefined;
  const ids = Object.keys(m.miembros);
  const respondieron: Record<string, number> = {};
  const misRespuestas: Record<string, string> = {};
  for (const item of r.items) {
    const del = r.respuestas[item.id] ?? {};
    respondieron[item.id] = ids.filter((id) => del[id]).length;
    if (del[yo]) misRespuestas[item.id] = del[yo];
  }
  const respuestas = revelada
    ? Object.fromEntries(r.items.map((item) => [
        item.id,
        Object.entries(r.respuestas[item.id] ?? {}).map(([participante, texto]) => ({ participante, roles: m.miembros[participante] ?? [], texto })),
      ]))
    : null;
  return {
    numero: r.numero, lanzadaEn: r.lanzadaEn, items: r.items, revelada, misRespuestas, respondieron, total: ids.length, respuestas,
    resultados: r.resultados,
  };
}

function vistaMesa(e: EstadoDeSesion, m: Mesa, yo: string, roles: Rol[]): VistaMesa {
  const { rondas, traspaso: _traspaso, i2c: _i2c, ...resto } = m;
  const esCliente = roles.some((r) => r === 'PO' || r === 'SD' || r === 'SD2');
  const ocultarTarjetas = esCliente && tramoActual(e) === 'a52' && !m.reabiertos.includes('a53');
  const i2c = Object.fromEntries(
    tarjetasCriticas(m.tarjetas).map((t) => {
      const fila = filaI2C(m, t.id);
      return [t.id, { ...fila, resultado: resultadoFilaI2C(fila) }];
    }),
  );
  return {
    ...structuredClone(resto),
    tarjetas: ocultarTarjetas ? [] : structuredClone(m.tarjetas),
    i2c: ocultarTarjetas ? {} : i2c,
    integrantes: Object.entries(m.miembros).map(([id, r]) => ({
      id, apodo: e.participantes[id]?.apodo, roles: r, conectado: e.participantes[id]?.conectado ?? false,
    })),
    rondas: rondas.map((r) => vistaRonda(m, r, yo)),
  };
}

export function vistaJugador(e: EstadoDeSesion, participanteId: string, ahora: number): VistaJugador {
  const p = e.participantes[participanteId];
  const sesion = vistaSesion(e, ahora);
  const tramo = tramoActual(e);
  const yo = {
    id: p.id, apodo: p.apodo, mesa: p.mesa, roles: p.roles, espectador: p.espectador, cartaLeida: p.cartaLeida,
  };
  const vacio: VistaJugador = {
    tipo: 'jugador', yo, sesion, ahora: { paraTodos: paraTodos(e), paraMi: [] }, roles: e.contenido.roles, carta: null, hojas: [],
    contexto: null, mesa: null, lecturas: null, traspaso: { comoLector: null, comoPO: null }, medicion: null, destape: null,
    cuestionario: null, fichaTecnica: null,
  };
  if (p.espectador || p.mesa === null) return vacio;

  const m = e.mesas[p.mesa];
  const roles = p.roles;
  const cartaDe = roles.find((r): r is 'PO' | 'SD' | 'SD2' | 'AN' | 'QA' => ['PO', 'SD', 'SD2', 'AN', 'QA'].includes(r));
  const hojas = roles.filter((r): r is 'FR' | 'RT' => r === 'FR' || r === 'RT').map((r) => e.contenido.hojas[r].texto);

  const origen = mesaQueLee(e.mesas, p);
  let comoLector: VistaJugador['traspaso']['comoLector'] = null;
  if (origen) {
    const criticas = tarjetasCriticas(origen.lineaBase.instantanea?.tarjetas ?? []);
    const tarjetas = criticas.slice(0, muestraTraspaso(criticas.length));
    const mias = Object.fromEntries(tarjetas.map((t) => [t.id, origen.traspaso.items[t.id]?.reconstruccion ?? '']));
    comoLector = { mesa: origen.numero, tarjetas: structuredClone(tarjetas), mias };
  }
  const comoPO = roles.includes('PO') && m.traspaso.lectorMesa !== undefined ? structuredClone(m.traspaso.items) : null;

  const fase: 'previa' | 'posterior' | null =
    tramo === 'medicion_previa' ? 'previa' : tramo === 'medicion_posterior' ? 'posterior' : null;
  const permiteCarta = fase === 'previa' && e.contenido.protocolo?.cartaEnPrevia === true;
  const medicion = fase
    ? { fase, preguntas: e.contenido.medicion, respondida: Boolean(e.medicion[p.id]?.[fase]), permiteCarta }
    : null;

  return {
    ...vacio,
    ahora: { paraTodos: paraTodos(e), paraMi: instruccionesDe(e, roles) },
    carta: cartaDe && (!fase || permiteCarta) ? e.contenido.cartas[cartaDe] : null,
    hojas: !fase || permiteCarta ? hojas : [],
    contexto: {
      canvas: e.contenido.plantillas.canvas, mapa: e.contenido.plantillas.mapa,
      chequeoSuficiencia: e.contenido.plantillas.chequeoSuficiencia, declaracion: e.contenido.plantillas.declaracion,
    },
    mesa: vistaMesa(e, m, p.id, roles),
    lecturas: roles.includes('FR') || roles.includes('RT') ? lecturasMesa(m) : null,
    traspaso: { comoLector, comoPO },
    medicion,
    destape: tramo === 'destape' ? e.contenido.destape : null,
    cuestionario: e.estado === 'cerrada' ? { preguntas: e.contenido.cuestionario, respondido: Boolean(e.cuestionario[p.id]) } : null,
    fichaTecnica: !fase && m.fichaPedidas.some((f) => f.por === p.id) ? e.contenido.fichaTecnica : null,
  };
}

function resumenMesa(e: EstadoDeSesion, m: Mesa): ResumenMesa {
  const ids = Object.keys(m.miembros);
  const ultima = m.rondas[m.rondas.length - 1];
  const tramo = tramoActual(e);
  const fase = tramo === 'medicion_previa' ? 'previa' : tramo === 'medicion_posterior' ? 'posterior' : null;
  return {
    numero: m.numero, personas: ids.length, conectados: ids.filter((id) => e.participantes[id]?.conectado).length,
    necesidades: m.necesidades.length, terminos: m.glosario.length, tarjetas: m.tarjetas.length, divergencias: m.divergencias.length,
    congelada: m.lineaBase.congeladaEn !== undefined,
    ...(fase ? { medicion: { respondieron: ids.filter((id) => Boolean(e.medicion[id]?.[fase])).length, total: ids.length } } : {}),
    ...(e.estado === 'cerrada' ? { cuestionario: { respondieron: ids.filter((id) => Boolean(e.cuestionario[id])).length, total: ids.length } } : {}),
    ronda: ultima
      ? {
          numero: ultima.numero, total: ids.length, revelada: ultima.reveladaEn !== undefined,
          terminaEn: ultima.lanzadaEn + ESPERA_RONDA_MS / e.velocidad,
          respondieron: ids.filter((id) => ultima.items.every((i) => ultima.respuestas[i.id]?.[id])).length,
        }
      : null,
  };
}

export function vistaLeandro(e: EstadoDeSesion, ahora: number, publicUrl: string): VistaLeandro {
  const cerrada = inscripcionCerrada(e);
  const provisionales: ResumenMesa[] = [];
  if (!cerrada) {
    for (let i = 0; i < e.llegadas.length; i += 6) {
      const ids = e.llegadas.slice(i, i + 6);
      provisionales.push({
        numero: i / 6 + 1, personas: ids.length, conectados: ids.filter((id) => e.participantes[id]?.conectado).length,
        necesidades: 0, terminos: 0, tarjetas: 0, divergencias: 0, congelada: false, ronda: null,
      });
    }
  }
  const mesas = cerrada ? Object.values(e.mesas).sort((a, b) => a.numero - b.numero).map((m) => resumenMesa(e, m)) : provisionales;
  const rondasLanzadas = [...new Set(Object.values(e.mesas).flatMap((m) => m.rondas.map((r) => r.numero)))].sort();
  const participantes = Object.values(e.participantes);
  return {
    tipo: 'leandro', sesion: vistaSesion(e, ahora), enlace: `${publicUrl.replace(/\/$/, '')}/?c=${e.codigo}`, paraTodos: paraTodos(e),
    conectados: participantes.filter((p) => p.conectado).length, inscritos: participantes.length, mesas, rondasLanzadas,
    destape: tramoActual(e) === 'destape' || e.estado === 'cerrada' ? e.contenido.destape : null,
    entrevista: e.estado === 'cerrada' ? { preguntas: e.contenido.entrevista, notas: e.entrevista } : null,
    cuestionario: {
      afirmaciones: e.contenido.cuestionario.afirmaciones.length,
      utilidad: e.contenido.cuestionario.utilidad?.items.length ?? 0,
      tlx: e.contenido.cuestionario.tlx.length,
      comentarios: e.contenido.cuestionario.utilidad ? 2 : 1,
    },
  };
}

export function vistaAutores(e: EstadoDeSesion, ahora: number): VistaAutores {
  return {
    tipo: 'autores', sesion: vistaSesion(e, ahora), estado: e,
    lecturas: Object.fromEntries(Object.values(e.mesas).map((m) => [m.numero, lecturasMesa(m)])),
  };
}

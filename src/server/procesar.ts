import { esquemasComando, esTipoComando, mensajeDeValidacion, type Comando } from '../shared/comandos.js';
import type { Actor, EventoSinSeq, NumeroRonda } from '../shared/eventos.js';
import { siguienteId } from '../shared/ids.js';
import { mesaQueLee, muestraTraspaso, tarjetasCriticas } from '../shared/lecturas.js';
import { asignarRoles, ErrorReparto, repartirMesas } from '../shared/mesas.js';
import { inscripcionCerrada, NO_PUEDE, puede, rolesEfectivos, tramoActual } from '../shared/permisos.js';
import type { Divergencia, EstadoDeSesion, Mesa, Necesidad, PerfilApertura, Tarjeta, Termino } from '../shared/tipos.js';
import { MAX_TEXTO, TRAMOS, type DetectadaEn, type Rol, type TecnicaI3 } from '../shared/valores.js';

export type ResultadoComando = { ok: true; eventos: EventoSinSeq[] } | { ok: false; error: string };

const falla = (error: string): ResultadoComando => ({ ok: false, error });
const bien = (eventos: EventoSinSeq[]): ResultadoComando => ({ ok: true, eventos });
const TRAMO_CAMBIO = 'El tramo ya cambió; mira la pantalla antes de volver a avanzar';

// Copia sobre `base` solo los campos definidos: al editar, lo que no llega no se pisa.
function fusionar<T extends object>(base: T, cambios: Partial<T>): T {
  const r = { ...base };
  for (const [k, v] of Object.entries(cambios)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
  return r;
}

const sinId = <T extends { id?: string }>(d: T): Omit<T, 'id'> => {
  const { id: _id, ...resto } = d;
  return resto;
};

export function detectadaEnTecnica(tecnica: TecnicaI3): DetectadaEn {
  return `I3 ${tecnica.charAt(0).toLowerCase()}${tecnica.slice(1)}` as DetectadaEn;
}

function terminoPorNombre(m: Mesa, nombre: string): string {
  const buscado = nombre.trim().toLowerCase();
  return m.glosario.find((t) => t.termino.trim().toLowerCase() === buscado)?.id ?? '';
}

function nuevaDivergencia(m: Mesa, datos: Pick<Divergencia, 'detectadaEn' | 'afectaA' | 'descripcion'>, creadaPor: string): Divergencia {
  return {
    id: siguienteId('D', m.divergencias), resolucion: '', estado: 'Pendiente', responsable: '', fechaLimite: '', creadaPor,
    ...datos, descripcion: datos.descripcion.slice(0, MAX_TEXTO),
  };
}

export function procesarComando(
  estado: EstadoDeSesion, actor: Actor, c: Comando, ahora: number, azar: () => number = Math.random,
): ResultadoComando {
  if (!esTipoComando(c.tipo)) return falla('Comando desconocido');
  const validado = esquemasComando[c.tipo].safeParse(c.datos ?? {});
  if (!validado.success) return falla(mensajeDeValidacion(validado.error));
  const permiso = puede(estado, actor, c.tipo);
  if (!permiso.ok) return falla(permiso.motivo);

  const d = validado.data as Record<string, any>;
  const comun = { en: ahora, opId: c.opId };

  if (actor.tipo !== 'participante') {
    return procesarConduccion(estado, { ...comun, por: actor }, c.tipo, d, azar);
  }

  const p = estado.participantes[actor.id];
  const m = estado.mesas[p.mesa as number];
  const por: Actor = { tipo: 'participante', id: p.id, roles: p.roles };
  const base = { ...comun, por, mesa: m.numero };
  const ev = <T extends EventoSinSeq['tipo']>(tipo: T, datos: Extract<EventoSinSeq, { tipo: T }>['datos'], mesa = m.numero) =>
    ({ ...base, mesa, tipo, datos }) as EventoSinSeq;

  switch (c.tipo) {
    case 'leerCarta':
      return bien([ev('carta.leida', { participante: p.id })]);
    case 'pedirFicha':
      return bien([ev('ficha.pedida', { participante: p.id })]);
    case 'responderMedicion': {
      const abierta = d.fase === 'previa' ? 'medicion_previa' : 'medicion_posterior';
      if (tramoActual(estado) !== abierta) return falla('Esta medición no está abierta');
      return bien([ev('medicion.respondida', { participante: p.id, fase: d.fase, respuestas: d.respuestas })]);
    }
    case 'escribirVersion': {
      const perfil = (['PO', 'SD', 'AN'] as const).find((r) => p.roles.includes(r)) as PerfilApertura;
      return bien([ev('apertura.version', { perfil, texto: d.texto, participante: p.id })]);
    }
    case 'marcarEquivalencia': {
      const eventos: EventoSinSeq[] = [];
      if (d.valor === 'No') {
        const etiqueta = estado.contenido.roles[d.perfil as Rol]?.etiqueta ?? d.perfil;
        const descripcion = `La versión de ${etiqueta} no dice lo mismo que las demás`;
        const yaEsta = m.divergencias.some((x) => x.detectadaEn === 'A4 apertura' && x.descripcion === descripcion);
        if (!yaEsta) eventos.push(ev('divergencia.guardada', { divergencia: nuevaDivergencia(m, { detectadaEn: 'A4 apertura', afectaA: '', descripcion }, p.id) }));
      }
      eventos.push(ev('apertura.marca', { perfil: d.perfil, valor: d.valor }));
      return bien(eventos);
    }
    case 'guardarAjustes':
      return bien([ev('apertura.ajustes', { texto: d.texto })]);
    case 'guardarTermino': {
      const previo = d.id ? m.glosario.find((t) => t.id === d.id) : undefined;
      if (d.id && !previo) return falla('No existe ese término');
      if (!previo && !d.termino) return falla('Escribe el término');
      const inicial: Termino = previo ?? {
        id: siguienteId('T', m.glosario), termino: '', definicion: '', ejemplo: '', critico: 'No', estado: 'Tentativo', responsable: '', editadoPor: '',
      };
      return bien([ev('termino.guardado', { termino: { ...fusionar(inicial, sinId(d)), editadoPor: p.id } })]);
    }
    case 'guardarNecesidad': {
      const previo = d.id ? m.necesidades.find((n) => n.id === d.id) : undefined;
      if (d.id && !previo) return falla('No existe esa necesidad');
      if (!previo && !d.necesidad) return falla('Escribe la necesidad');
      if (!previo && !d.fuente) return falla('Elige la fuente de la necesidad');
      const inicial: Necesidad = previo ?? {
        id: siguienteId('N', m.necesidades), bloque: 1, necesidad: '', fuente: '', contextoValor: '', supuestos: '', estado: 'Nueva', editadoPor: '',
      };
      return bien([ev('necesidad.guardada', { necesidad: { ...fusionar(inicial, sinId(d)), editadoPor: p.id } })]);
    }
    case 'responderRonda': {
      const ronda = m.rondas.find((r) => r.numero === d.numero);
      if (!ronda) return falla('La ronda no está abierta');
      if (ronda.reveladaEn !== undefined) return falla('La ronda ya se reveló');
      if (!ronda.items.some((i) => i.id === d.itemId)) return falla('No existe ese ítem en la ronda');
      const eventos = [ev('ronda.respondida', { numero: d.numero, itemId: d.itemId, participante: p.id, texto: d.texto })];
      const respuestas: Record<string, Record<string, string>> = {
        ...ronda.respuestas, [d.itemId]: { ...ronda.respuestas[d.itemId], [p.id]: d.texto },
      };
      const miembros = Object.keys(m.miembros);
      if (ronda.items.every((i) => miembros.every((id) => respuestas[i.id]?.[id]))) {
        eventos.push(ev('ronda.revelada', { numero: d.numero }));
      }
      return bien(eventos);
    }
    case 'marcarRonda': {
      const ronda = m.rondas.find((r) => r.numero === d.numero);
      if (!ronda) return falla('La ronda no está abierta');
      if (ronda.reveladaEn === undefined) return falla('Todavía no se revelaron las respuestas');
      const item = ronda.items.find((i) => i.id === d.itemId);
      if (!item) return falla('No existe ese ítem en la ronda');
      const eventos: EventoSinSeq[] = [];
      let divergenciaId = ronda.resultados[d.itemId]?.divergenciaId;
      if (d.resultado !== 'Alineado' && !divergenciaId) {
        const respuestas = Object.entries(ronda.respuestas[d.itemId] ?? {})
          .map(([id, texto]) => `${(m.miembros[id] ?? []).join('+')}: ${texto}`).join('; ');
        const divergencia = nuevaDivergencia(m, {
          detectadaEn: detectadaEnTecnica(item.tecnica), afectaA: terminoPorNombre(m, item.termino),
          descripcion: `Ronda ${d.numero} · «${item.termino}»: ${respuestas}`,
        }, p.id);
        divergenciaId = divergencia.id;
        eventos.push(ev('divergencia.guardada', { divergencia }));
      }
      eventos.push(ev('ronda.marcada', { numero: d.numero, itemId: d.itemId, resultado: d.resultado, participante: p.id, ...(divergenciaId ? { divergenciaId } : {}) }));
      return bien(eventos);
    }
    case 'cambiarItemRonda': {
      if (m.rondas.some((r) => r.numero === d.numero)) return falla('Esa ronda ya se lanzó');
      const plan = m.planI3.find((r) => r.numero === d.numero);
      if (!plan?.items.some((i) => i.id === d.itemId)) return falla('No existe ese ítem en la ronda');
      const item = { id: d.itemId, termino: d.termino, tecnica: d.tecnica, pregunta: d.pregunta };
      return bien([ev('ronda.item.cambiado', { numero: d.numero as NumeroRonda, itemId: d.itemId, item })]);
    }
    case 'marcarChequeos': {
      const previo = m.chequeosBloque;
      return bien([ev('chequeos.marcados', { c5: d.c5 ?? previo.c5, c6: d.c6 ?? previo.c6, obs: d.obs ?? previo.obs })]);
    }
    case 'guardarTarjeta': {
      const previo = d.id ? m.tarjetas.find((t) => t.id === d.id) : undefined;
      if (d.id && !previo) return falla('No existe esa tarjeta');
      if (d.necesidadId && !m.necesidades.some((n) => n.id === d.necesidadId)) return falla('Elige una necesidad de origen que exista');
      if (!previo && !d.necesidadId) return falla('Elige una necesidad de origen que exista');
      if (!previo && !d.enunciado) return falla('Escribe el enunciado del requisito');
      const inicial: Tarjeta = previo ?? {
        id: siguienteId('R', m.tarjetas), necesidadId: '', tipo: 'Funcional', enunciado: '', critico: 'No', criterioEjemplo: '',
        restriccion: '', acepta: '', editadoPor: '',
      };
      return bien([ev('tarjeta.guardada', { tarjeta: { ...fusionar(inicial, sinId(d)), editadoPor: p.id } })]);
    }
    case 'marcarI2A':
      if (!m.tarjetas.some((t) => t.id === d.tarjetaId)) return falla('No existe esa tarjeta');
      return bien([ev('i2a.marcada', { tarjetaId: d.tarjetaId, revision: d.revision, nota: d.nota ?? '' })]);
    case 'escribirEsperado':
      if (!m.necesidades.some((n) => n.id === d.necesidadId)) return falla('No existe esa necesidad');
      return bien([ev('esperado.escrito', { necesidadId: d.necesidadId, texto: d.texto })]);
    case 'marcarI2B':
      return bien([ev('i2b.marcada', { campo: d.campo, valor: d.valor, obs: d.obs ?? '' })]);
    case 'marcarI2C': {
      const roles = rolesEfectivos(p.roles, {});
      const permitido = d.campo === 'C3' ? roles.includes('FR') : roles.includes('PO') || roles.includes('SD');
      if (!permitido) return falla(NO_PUEDE);
      const tarjeta = m.tarjetas.find((t) => t.id === d.tarjetaId);
      if (!tarjeta) return falla('No existe esa tarjeta');
      if (tarjeta.critico !== 'Sí') return falla('Solo las tarjetas críticas se validan en la parte C');
      const eventos: EventoSinSeq[] = [];
      let divergenciaId = m.i2c[d.tarjetaId]?.divergenciaId;
      if (d.valor === 'No' && !divergenciaId) {
        const divergencia = nuevaDivergencia(m, {
          detectadaEn: 'I2 aceptación', afectaA: d.tarjetaId, descripcion: `${d.campo} en «No» para ${d.tarjetaId}: ${tarjeta.enunciado}`,
        }, p.id);
        divergenciaId = divergencia.id;
        eventos.push(ev('divergencia.guardada', { divergencia }));
      }
      eventos.push(ev('i2c.marcada', { tarjetaId: d.tarjetaId, campo: d.campo, valor: d.valor, ...(divergenciaId ? { divergenciaId } : {}) }));
      return bien(eventos);
    }
    case 'guardarDivergencia': {
      const previo = d.id ? m.divergencias.find((x) => x.id === d.id) : undefined;
      if (d.id && !previo) return falla('No existe esa divergencia');
      if (!previo && !d.descripcion) return falla('Escribe quién entiende qué');
      if (d.afectaA && /^[RT]-/.test(d.afectaA)) {
        const existe = d.afectaA.startsWith('R-') ? m.tarjetas.some((t) => t.id === d.afectaA) : m.glosario.some((t) => t.id === d.afectaA);
        if (!existe) return falla('No existe ese requisito o término');
      }
      const inicial: Divergencia = previo ?? nuevaDivergencia(m, { detectadaEn: 'Otra', afectaA: '', descripcion: '' }, p.id);
      return bien([ev('divergencia.guardada', { divergencia: fusionar(inicial, sinId(d)) })]);
    }
    case 'guardarValidacion06':
      return bien([ev('validacion06.guardada', fusionar(m.validacion06, d))]);
    case 'congelarLineaBase':
      if (m.lineaBase.congeladaEn !== undefined) return falla('La línea base ya está congelada');
      return bien([ev('lineabase.congelada', { por: p.id })]);
    case 'marcarEvidencia':
      return bien([ev('evidencia.marcada', { evidencia: d.evidencia, resultado: d.resultado, nota: d.nota ?? '' })]);
    case 'reconstruir': {
      const origen = mesaQueLee(estado.mesas, p);
      if (!origen) return falla(NO_PUEDE);
      const criticas = tarjetasCriticas(origen.lineaBase.instantanea?.tarjetas ?? []);
      const muestra = criticas.slice(0, muestraTraspaso(criticas.length)).map((t) => t.id);
      if (!muestra.includes(d.tarjetaId)) return falla('Esa tarjeta no está en la muestra del traspaso');
      return bien([ev('traspaso.reconstruido', { tarjetaId: d.tarjetaId, texto: d.texto }, origen.numero)]);
    }
    case 'confirmarTraspaso': {
      const item = m.traspaso.items[d.tarjetaId];
      if (!item?.reconstruccion) return falla('Todavía no llegó la reconstrucción de esa tarjeta');
      const eventos: EventoSinSeq[] = [];
      // Una sola divergencia por tarjeta: volver a confirmar «No» (para guardar la corrección) no crea otra.
      const yaRegistrada = m.divergencias.some((x) => x.detectadaEn === 'Prueba de traspaso' && x.afectaA === d.tarjetaId);
      if (d.coincide === 'No' && !yaRegistrada) {
        eventos.push(ev('divergencia.guardada', {
          divergencia: nuevaDivergencia(m, {
            detectadaEn: 'Prueba de traspaso', afectaA: d.tarjetaId,
            descripcion: `La reconstrucción de ${d.tarjetaId} no coincide: ${item.reconstruccion}`,
          }, p.id),
        }));
      }
      eventos.push(ev('traspaso.confirmado', { tarjetaId: d.tarjetaId, coincide: d.coincide, correccion: d.correccion ?? '' }));
      return bien(eventos);
    }
    case 'guardarAccion':
      return bien([ev('accion.guardada', {
        ...(d.indice !== undefined ? { indice: d.indice } : {}),
        accion: { origen: d.origen, accion: d.accion, responsable: d.responsable, fecha: d.fecha },
      })]);
    case 'marcarDestape':
      return bien([ev('destape.marcado', { divergencia: d.divergencia, registrada: d.registrada })]);
    case 'responderCuestionario':
      return bien([ev('cuestionario.respondido', { participante: p.id, afirmaciones: d.afirmaciones, tlx: d.tlx, abierta: d.abierta })]);
    default:
      return falla(NO_PUEDE);
  }
}

function procesarConduccion(
  estado: EstadoDeSesion,
  base: { en: number; opId: string; por: Actor },
  tipo: Comando['tipo'],
  d: Record<string, any>,
  azar: () => number,
): ResultadoComando {
  const ev = <T extends EventoSinSeq['tipo']>(t: T, datos: Extract<EventoSinSeq, { tipo: T }>['datos'], mesa?: number) =>
    ({ ...base, ...(mesa !== undefined ? { mesa } : {}), tipo: t, datos }) as EventoSinSeq;

  switch (tipo) {
    case 'cerrarInscripcion': {
      if (estado.estado !== 'inscripcion' || inscripcionCerrada(estado)) return falla('La inscripción ya está cerrada');
      try {
        const reparto = repartirMesas(estado.llegadas);
        const mesas = reparto.mesas.map((mesa, i) => ({ numero: i + 1, miembros: asignarRoles(mesa, azar) }));
        return bien([ev('inscripcion.cerrada', { mesas, espectadores: reparto.espectadores })]);
      } catch (e) {
        if (e instanceof ErrorReparto) return falla(e.message);
        throw e;
      }
    }
    case 'avanzarTramo': {
      if (!inscripcionCerrada(estado)) return falla('Primero cierra la inscripción y reparte los roles');
      if (estado.estado === 'cerrada' || estado.estado === 'terminada') return falla('La sesión ya terminó');
      if (d.desde !== undefined && d.desde !== estado.tramoIndice) return falla(TRAMO_CAMBIO);
      const siguiente = estado.tramoIndice === null ? 0 : estado.tramoIndice + 1;
      if (siguiente >= TRAMOS.length) return bien([ev('sesion.cerrada', {})]);
      return bien([ev('tramo.iniciado', { indice: siguiente })]);
    }
    case 'retrocederTramo':
      if (estado.estado !== 'en_curso' || !estado.tramoIndice) return falla('No hay un tramo anterior');
      if (d.desde !== undefined && d.desde !== estado.tramoIndice) return falla(TRAMO_CAMBIO);
      return bien([ev('tramo.iniciado', { indice: estado.tramoIndice - 1 })]);
    case 'lanzarRonda': {
      if (estado.estado !== 'en_curso' || tramoActual(estado) !== 'a51') return falla('Las rondas se lanzan en el encuentro 1 (A5.1)');
      if (Object.values(estado.mesas).some((m) => m.rondas.some((r) => r.numero === d.numero))) return falla('Esa ronda ya se lanzó');
      return bien([ev('ronda.lanzada', { numero: d.numero }), ev('hito.hecho', { id: `ronda${d.numero}` })]);
    }
    case 'pausar':
      if (estado.pausadaEn !== null) return falla('El cronómetro ya está en pausa');
      return bien([ev('cronometro.pausado', {})]);
    case 'reanudar':
      if (estado.pausadaEn === null) return falla('El cronómetro no está en pausa');
      return bien([ev('cronometro.reanudado', {})]);
    case 'notaEntrevista':
      return bien([ev('entrevista.nota', { pregunta: d.pregunta, texto: d.texto })]);
    case 'moverParticipante': {
      if (!estado.participantes[d.participanteId]) return falla('No existe esa persona en la sesión');
      if (d.mesa !== null && !estado.mesas[d.mesa]) return falla('No existe esa mesa');
      return bien([ev('participante.movido', {
        id: d.participanteId, mesa: d.mesa, roles: d.roles, espectador: d.espectador ?? d.mesa === null,
      })]);
    }
    case 'reabrirPlantilla':
      if (!estado.mesas[d.mesa]) return falla('No existe esa mesa');
      return bien([ev('plantilla.reabierta', { tramo: d.tramo }, d.mesa)]);
    case 'repetirRonda': {
      const m = estado.mesas[d.mesa];
      if (!m) return falla('No existe esa mesa');
      if (!m.rondas.some((r) => r.numero === d.numero)) return falla('Esa ronda todavía no se lanzó en esa mesa');
      if (tramoActual(estado) !== 'a51' && !m.reabiertos.includes('a51')) {
        return falla('La ronda se repite en A5.1; para hacerlo después, reabre A5.1 en esa mesa');
      }
      return bien([ev('ronda.repetida', { numero: d.numero }, d.mesa)]);
    }
    case 'cambiarAvance':
      return bien([ev('avance.cambiado', { automatico: d.automatico })]);
    default:
      return falla('Esto lo hacen los participantes desde su celular');
  }
}

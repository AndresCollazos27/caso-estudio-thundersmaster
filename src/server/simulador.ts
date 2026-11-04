// Participantes simulados para las sesiones de prueba. Cada uno mira su propia vista, como una persona con su
// celular, y usa los mismos comandos; las respuestas salen de `contenido.bots`.
import type { DatosComando, TipoComando } from '../shared/comandos.js';
import type { Contenido } from '../shared/contenido.js';
import type { Actor } from '../shared/eventos.js';
import { restanteMs } from '../shared/tiempo.js';
import type { Rol } from '../shared/valores.js';
import { vistaJugador, type VistaJugador } from '../shared/vistas.js';
import type { GestorSesiones } from './gestor.js';

// Con menos tiempo que esto por delante en el tramo, cada simulado hace en su turno todo lo que le falta.
const URGENTE_MS = 1000;
// Una acción puede habilitar otra (la última respuesta revela la ronda y el FR la marca): se dan varias vueltas.
const VUELTAS_MAX = 10;

const AJUSTES = 'Se acordó que Tomatera avisa y la persona decide cuándo regar.';
const RESOLUCION = 'Se aclaró con la clienta y quedó en el glosario.';
const CORRECCION = 'Falta el umbral exacto.';

type Bots = Contenido['bots'];

interface Accion {
  clave: string;
  tipo: TipoComando;
  datos: unknown;
}

interface Bot {
  id: string;
  indice: number;
  hechas: Set<string>;
}

export interface Rechazo {
  participante: string;
  tipo: TipoComando;
  error: string;
}

export interface Simulador {
  paso(): void;
  detener(): void;
  readonly rechazos: Rechazo[];
}

const accion = <K extends TipoComando>(clave: string, tipo: K, datos: DatosComando<K>): Accion => ({ clave, tipo, datos });

// mulberry32: azar repetible a partir de una semilla.
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function barajar<T>(lista: T[], azar: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Lo que el simulado haría ahora según lo que ve, en orden de prioridad. `k` da un azar fijo para cada decisión.
function candidatas(v: VistaJugador, bots: Bots, k: (clave: string) => number): Accion[] {
  const a: Accion[] = [];
  if (v.cuestionario) {
    if (!v.cuestionario.respondido) {
      a.push(accion('cuestionario', 'responderCuestionario', {
        afirmaciones: [0, 1, 2, 3, 4].map((i) => 2 + Math.floor(k(`afirmacion:${i}`) * 4)),
        tlx: [0, 1, 2, 3, 4, 5].map((i) => 5 * Math.floor(k(`tlx:${i}`) * 21)),
        abierta: '',
      }));
    }
    return a;
  }
  const m = v.mesa;
  if (!m) return a;
  const roles = v.yo.roles;
  const tiene = (r: Rol) => roles.includes(r);
  const principal = roles[0];

  if (!v.yo.cartaLeida) a.push(accion('carta', 'leerCarta', {}));
  if (v.medicion && !v.medicion.respondida) {
    const previa = bots.medicion.previa[principal] ?? bots.medicion.previa.FR;
    const respuestas = v.medicion.fase === 'previa' && previa ? previa : bots.medicion.posterior;
    a.push(accion(`medicion:${v.medicion.fase}`, 'responderMedicion', { fase: v.medicion.fase, respuestas }));
  }

  switch (v.sesion.tramo) {
    case 'a4': {
      const perfil = (['PO', 'SD', 'AN'] as const).find((r) => tiene(r));
      if (perfil && !m.apertura.versiones[perfil]) a.push(accion('version', 'escribirVersion', { texto: bots.versiones[perfil] }));
      if (tiene('FR')) {
        for (const p of ['PO', 'SD', 'AN'] as const) {
          if (!m.apertura.versiones[p] || m.apertura.equivalencia[p]) continue;
          // La versión del PO simulado pide que riegue sola, y las otras dos, que avise.
          const valor = p === 'PO' || k(`equivalencia:${p}`) < 0.2 ? 'No' : 'Sí';
          a.push(accion(`equivalencia:${p}`, 'marcarEquivalencia', { perfil: p, valor }));
        }
        if (Object.keys(m.apertura.equivalencia).length === 3 && !m.apertura.ajustes) {
          a.push(accion('ajustes', 'guardarAjustes', { texto: AJUSTES }));
        }
      }
      break;
    }
    case 'a51': {
      for (const r of m.rondas) {
        if (r.revelada) continue;
        for (const item of r.items) {
          if (r.misRespuestas[item.id]) continue;
          const texto = bots.rondas[item.id]?.[principal] || 'No sé.';
          // La hora de lanzamiento va en la clave: si los autores repiten la ronda, se vuelve a responder.
          a.push(accion(`ronda:${r.numero}:${r.lanzadaEn}:${item.id}`, 'responderRonda', { numero: r.numero, itemId: item.id, texto }));
        }
      }
      if (tiene('FR')) {
        for (const r of m.rondas) {
          if (!r.revelada) continue;
          for (const item of r.items) {
            if (r.resultados[item.id]) continue;
            const resultado = bots.marcas[item.id] ?? 'Pendiente';
            a.push(accion(`marca:${r.numero}:${r.lanzadaEn}:${item.id}`, 'marcarRonda', { numero: r.numero, itemId: item.id, resultado }));
          }
        }
        if (m.rondas.length === 2 && m.rondas.every((r) => r.items.every((i) => r.resultados[i.id]))) {
          a.push(accion('chequeos', 'marcarChequeos', { c5: 'Sí', c6: k('c6') < 0.3 ? 'Pendiente' : 'Sí' }));
        }
      }
      if (tiene('AN')) {
        const i = m.necesidades.length;
        const n = bots.necesidades[i];
        if (n) {
          // La fuente es un actor del mapa (02), como en la columna D de la plantilla 04.
          const nombre = v.roles[n.fuente]?.nombre ?? n.fuente;
          const fuente = v.contexto?.mapa.find((x) => x.actor.startsWith(nombre))?.actor ?? nombre;
          a.push(accion(`necesidad:${i}`, 'guardarNecesidad', { necesidad: n.necesidad, fuente, supuestos: n.supuestos, prioridad: n.prioridad }));
        }
        for (const r of m.rondas) {
          for (const item of r.items) {
            const resultado = r.resultados[item.id]?.resultado;
            const t = m.glosario.find((g) => g.termino === item.termino);
            if (!resultado || !t || t.estado !== 'Tentativo') continue;
            a.push(accion(`termino:${t.id}`, 'guardarTermino', { id: t.id, estado: resultado === 'Alineado' ? 'Acordado' : 'En divergencia' }));
          }
        }
      }
      if (k('ficha') < 0.15) a.push(accion('ficha', 'pedirFicha', {}));
      break;
    }
    case 'a52': {
      if (tiene('AN')) {
        bots.tarjetas.forEach((t, j) => {
          const n = m.necesidades[t.necesidad];
          if (!n) return;
          a.push(accion(`tarjeta:${j}`, 'guardarTarjeta', {
            necesidadId: n.id, enunciado: t.enunciado, criterioEjemplo: t.criterioEjemplo, critico: t.critico,
          }));
        });
      }
      if (tiene('QA')) {
        for (const t of m.tarjetas) {
          if (m.i2a[t.id]) continue;
          a.push(accion(`i2a:${t.id}`, 'marcarI2A', { tarjetaId: t.id, revision: k(`i2a:${t.id}`) < 0.2 ? 'Corregir' : 'Cumple' }));
        }
      }
      if (tiene('PO')) {
        for (const n of m.necesidades) {
          if (!m.esperadosPorNecesidad[n.id]) a.push(accion(`esperado:${n.id}`, 'escribirEsperado', { necesidadId: n.id, texto: bots.esperado }));
        }
      }
      break;
    }
    case 'a53': {
      // C1 y C2 los marca el cliente (PO); C3, el FR.
      const campos = [...(tiene('PO') ? (['C1', 'C2'] as const) : []), ...(tiene('FR') ? (['C3'] as const) : [])];
      if (campos.length > 0) {
        for (const [tarjetaId, fila] of Object.entries(m.i2c)) {
          for (const campo of campos) {
            if (fila[campo]) continue;
            const valor = k(`i2c:${tarjetaId}:${campo}`) < 0.1 ? 'No' : bots.i2c[campo];
            a.push(accion(`i2c:${tarjetaId}:${campo}`, 'marcarI2C', { tarjetaId, campo, valor }));
          }
        }
      }
      if (tiene('AN')) {
        for (const campo of ['B1', 'B2'] as const) {
          if (!m.i2b[campo]) a.push(accion(`i2b:${campo}`, 'marcarI2B', { campo, valor: 'Sí' }));
        }
      }
      if (tiene('QA')) {
        for (const t of m.glosario) {
          if (t.estado === 'Acordado') a.push(accion(`comprobado:${t.id}`, 'guardarTermino', { id: t.id, estado: 'Acordado y comprobado' }));
        }
      }
      if (tiene('RT')) {
        for (const d of m.divergencias) {
          if (d.estado !== 'Pendiente' || d.resolucion) continue;
          const datos = k(`divergencia:${d.id}`) < 0.6
            ? { id: d.id, estado: 'Resuelta y confirmada' as const, resolucion: RESOLUCION }
            : { id: d.id, responsable: 'Analista', fechaLimite: 'Próxima reunión' };
          a.push(accion(`divergencia:${d.id}`, 'guardarDivergencia', datos));
        }
        if (!m.validacion06.conformidad) {
          a.push(accion('validacion06', 'guardarValidacion06', {
            conjunto: m.tarjetas.map((t) => t.id).join(', '), fechaParticipantes: `Mesa ${m.numero}`,
            tecnica: 'Lectura en voz alta con la clienta', conformidad: 'Verbal',
          }));
        }
      }
      break;
    }
    case 'a6': {
      if (tiene('RT') && m.lineaBase.congeladaEn === undefined) a.push(accion('congelar', 'congelarLineaBase', {}));
      const lector = v.traspaso.comoLector;
      for (const t of lector?.tarjetas ?? []) {
        if (!lector?.mias[t.id]) a.push(accion(`reconstruir:${t.id}`, 'reconstruir', { tarjetaId: t.id, texto: bots.traspaso.reconstruccion }));
      }
      for (const [tarjetaId, item] of Object.entries(v.traspaso.comoPO ?? {})) {
        if (!item.reconstruccion || item.coincide) continue;
        const coincide = k(`traspaso:${tarjetaId}`) < 0.75 ? bots.traspaso.coincide : 'No';
        a.push(accion(`traspaso:${tarjetaId}`, 'confirmarTraspaso', { tarjetaId, coincide, ...(coincide === 'No' ? { correccion: CORRECCION } : {}) }));
      }
      if (tiene('FR') && v.lecturas) {
        for (const e of ['E1', 'E2', 'E3', 'E4', 'E5'] as const) {
          // E5 espera a que el traspaso tenga resultado.
          if (m.lineaBase.evidencias[e] || (e === 'E5' && v.lecturas.E5.valor === 'Pendiente')) continue;
          a.push(accion(`evidencia:${e}`, 'marcarEvidencia', { evidencia: e, resultado: v.lecturas[e].valor }));
        }
      }
      if (tiene('RT')) {
        for (const d of m.divergencias.filter((x) => x.estado === 'Pendiente').slice(0, 2)) {
          a.push(accion(`accion:${d.id}`, 'guardarAccion', { origen: d.id, accion: 'Confirmarlo con la clienta', responsable: 'Analista', fecha: 'Próxima reunión' }));
        }
      }
      break;
    }
    case 'destape': {
      if (tiene('FR')) {
        for (const t of v.destape ?? []) {
          if (m.destape[t.id] === undefined) a.push(accion(`destape:${t.id}`, 'marcarDestape', { divergencia: t.id, registrada: k(`destape:${t.id}`) < 0.5 }));
        }
      }
      break;
    }
  }
  return a;
}

export function simular(gestor: GestorSesiones, sesionId: string, n: number, o: { semilla: number }): Simulador {
  const inicial = gestor.estado(sesionId);
  if (!inicial) throw new Error('La sesión no existe');
  const previos = Object.values(inicial.participantes).filter((p) => p.bot).length;
  const bots: Bot[] = [];
  for (let i = 0; i < n; i++) {
    const indice = previos + i + 1;
    const r = gestor.unirse(inicial.codigo, `Simulado ${String(indice).padStart(2, '0')}`, true, true);
    if ('error' in r) throw new Error(r.error);
    gestor.registrarConexion(sesionId, r.participanteId, true);
    bots.push({ id: r.participanteId, indice, hechas: new Set() });
  }
  return crearSimulador(gestor, sesionId, bots, o);
}

// Después de un reinicio: los simulados que ya estaban en la sesión siguen donde iban. Lo que ya hicieron
// no se repite porque cada acción usa siempre el mismo opId y el servidor lo reconoce.
export function reanudarSimulados(gestor: GestorSesiones, sesionId: string, o: { semilla: number }): Simulador {
  const estado = gestor.estado(sesionId);
  if (!estado) throw new Error('La sesión no existe');
  const bots = Object.values(estado.participantes)
    .filter((p) => p.bot)
    .sort((a, b) => a.unidoEn - b.unidoEn)
    .map((p, i) => ({ id: p.id, indice: i + 1, hechas: new Set<string>() }));
  return crearSimulador(gestor, sesionId, bots, o);
}

function crearSimulador(gestor: GestorSesiones, sesionId: string, bots: Bot[], o: { semilla: number }): Simulador {
  const orden = generador(o.semilla);
  const rechazos: Rechazo[] = [];
  let activo = true;

  // Hace la primera acción pendiente del simulado; devuelve false si no tenía nada que hacer.
  function actuar(bot: Bot): boolean {
    const e = gestor.estado(sesionId);
    const p = e?.participantes[bot.id];
    if (!e || !p) return false;
    const k = (clave: string) => generador(hash(`${o.semilla}:${bot.indice}:${clave}`))();
    const siguiente = candidatas(vistaJugador(e, bot.id, gestor.ahora()), e.contenido.bots, k).find((x) => !bot.hechas.has(x.clave));
    if (!siguiente) return false;
    bot.hechas.add(siguiente.clave);
    const actor: Actor = { tipo: 'participante', id: bot.id, roles: p.roles };
    const r = gestor.ejecutar(sesionId, actor, { opId: `${bot.id}:${siguiente.clave}`, tipo: siguiente.tipo, datos: siguiente.datos });
    if (!r.ok) rechazos.push({ participante: bot.id, tipo: siguiente.tipo, error: r.error });
    return true;
  }

  return {
    rechazos,
    paso() {
      const e = gestor.estado(sesionId);
      if (!activo || !e || e.pausadaEn !== null) return;
      if (e.estado === 'terminada') {
        activo = false;
        return;
      }
      const urgente = e.estado === 'cerrada' || e.tramoIndice === null || restanteMs(e.contenido, e, gestor.ahora()) < URGENTE_MS;
      let actuaron = false;
      for (let vuelta = 0; vuelta < (urgente ? VUELTAS_MAX : 1); vuelta++) {
        let alguno = false;
        for (const bot of barajar(bots, orden)) {
          if (urgente) while (actuar(bot)) alguno = true;
          else alguno = actuar(bot) || alguno;
        }
        actuaron ||= alguno;
        if (!alguno) break;
      }
      // Con la sesión cerrada y el cuestionario respondido ya no queda nada por hacer.
      if (e.estado === 'cerrada' && !actuaron) activo = false;
    },
    detener() {
      if (!activo) return;
      activo = false;
      for (const b of bots) gestor.registrarConexion(sesionId, b.id, false);
    },
  };
}

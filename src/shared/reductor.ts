import type { Contenido } from './contenido.js';
import type { Evento } from './eventos.js';
import type { EstadoDeSesion, Mesa } from './tipos.js';
import type { Rol } from './valores.js';

export function crearMesa(numero: number, contenido: Contenido, miembros: Record<string, Rol[]>): Mesa {
  return {
    numero,
    miembros: { ...miembros },
    apertura: { versiones: {}, equivalencia: {}, ajustes: '' },
    glosario: contenido.plantillas.glosario.map((g, i) => ({
      id: `T-${String(i + 1).padStart(2, '0')}`,
      termino: g.termino,
      definicion: g.definicion,
      ejemplo: g.ejemplo,
      critico: g.critico,
      estado: g.estado,
      responsable: '',
      editadoPor: '',
    })),
    necesidades: [],
    tarjetas: [],
    i2a: {},
    i2b: { obsB1: '', obsB2: '' },
    i2c: {},
    esperadosPorNecesidad: {},
    planI3: contenido.rondas.map((r) => ({ numero: r.numero, items: r.items.map((i) => ({ ...i })) })),
    rondas: [],
    chequeosBloque: { obs: '' },
    validacion06: { conjunto: '', fechaParticipantes: '', tecnica: '', constancia: '' },
    divergencias: [],
    lineaBase: { evidencias: {} },
    traspaso: { items: {} },
    acciones: [],
    destape: {},
    fichaPedidas: [],
    reabiertos: [],
  };
}

function reemplazarPorId<T extends { id: string }>(lista: T[], nuevo: T): T[] {
  const i = lista.findIndex((x) => x.id === nuevo.id);
  if (i === -1) return [...lista, nuevo];
  const copia = [...lista];
  copia[i] = nuevo;
  return copia;
}

function quitarDeMesa(s: EstadoDeSesion, id: string): void {
  for (const m of Object.values(s.mesas)) delete m.miembros[id];
}

// Puro: copia el estado (salvo el contenido, que nunca cambia) y aplica el evento sobre la copia.
export function aplicarEvento(estado: EstadoDeSesion | null, ev: Evento): EstadoDeSesion {
  if (ev.tipo === 'sesion.creada') {
    const d = ev.datos;
    return {
      id: d.id, codigo: d.codigo, prueba: d.prueba, velocidad: d.velocidad, contenido: d.contenido, creadaEn: ev.en,
      estado: 'inscripcion', tramoIndice: null, tramoInicio: null, pausadaEn: null, pausaAcumulada: 0,
      avanceAutomatico: d.contenido.avance.automatico, hitosHechos: [], participantes: {}, llegadas: [], mesas: {},
      medicion: {}, cuestionario: {}, entrevista: [], ultimoSeq: ev.seq,
    };
  }
  if (!estado) throw new Error(`El evento ${ev.tipo} llegó antes de crear la sesión`);

  const { contenido, ...resto } = estado;
  const s: EstadoDeSesion = { ...structuredClone(resto), contenido };
  s.ultimoSeq = ev.seq;
  const mesa = ev.mesa !== undefined ? s.mesas[ev.mesa] : undefined;
  const conMesa = (): Mesa => {
    if (!mesa) throw new Error(`El evento ${ev.tipo} necesita una mesa existente`);
    return mesa;
  };

  switch (ev.tipo) {
    case 'participante.unido': {
      const d = ev.datos;
      s.participantes[d.id] = {
        id: d.id, apodo: d.apodo, mesa: d.mesa ?? null, roles: d.roles ?? [], espectador: d.espectador ?? false,
        bot: d.bot, conectado: true, unidoEn: ev.en, cartaLeida: false, ...(d.clave ? { clave: d.clave } : {}),
      };
      if (!s.llegadas.includes(d.id)) s.llegadas.push(d.id);
      if (d.mesa != null && s.mesas[d.mesa]) s.mesas[d.mesa].miembros[d.id] = d.roles ?? [];
      break;
    }
    case 'inscripcion.cerrada': {
      for (const { numero, miembros } of ev.datos.mesas) {
        s.mesas[numero] = crearMesa(numero, contenido, miembros);
        for (const [id, roles] of Object.entries(miembros)) {
          if (s.participantes[id]) Object.assign(s.participantes[id], { mesa: numero, roles, espectador: false });
        }
      }
      for (const id of ev.datos.espectadores) {
        if (s.participantes[id]) Object.assign(s.participantes[id], { mesa: null, roles: [], espectador: true });
      }
      break;
    }
    case 'participante.movido': {
      const d = ev.datos;
      quitarDeMesa(s, d.id);
      if (s.participantes[d.id]) Object.assign(s.participantes[d.id], { mesa: d.mesa, roles: d.roles, espectador: d.espectador ?? false });
      if (d.mesa != null && s.mesas[d.mesa]) s.mesas[d.mesa].miembros[d.id] = d.roles;
      break;
    }
    case 'tramo.iniciado':
      s.tramoIndice = ev.datos.indice;
      s.tramoInicio = ev.en;
      s.pausadaEn = null;
      s.pausaAcumulada = 0;
      if (s.estado === 'inscripcion') s.estado = 'en_curso';
      break;
    case 'cronometro.pausado':
      if (s.pausadaEn === null) s.pausadaEn = ev.en;
      break;
    case 'cronometro.reanudado':
      if (s.pausadaEn !== null) {
        s.pausaAcumulada += ev.en - s.pausadaEn;
        s.pausadaEn = null;
      }
      break;
    case 'avance.cambiado':
      s.avanceAutomatico = ev.datos.automatico;
      break;
    case 'hito.hecho':
      if (!s.hitosHechos.includes(ev.datos.id)) s.hitosHechos.push(ev.datos.id);
      break;
    case 'carta.leida':
      if (s.participantes[ev.datos.participante]) s.participantes[ev.datos.participante].cartaLeida = true;
      break;
    case 'ficha.pedida':
      conMesa().fichaPedidas.push({ por: ev.datos.participante, en: ev.en });
      break;
    case 'medicion.respondida': {
      const d = ev.datos;
      s.medicion[d.participante] = { ...s.medicion[d.participante], [d.fase]: [...d.respuestas] };
      break;
    }
    case 'apertura.version':
      conMesa().apertura.versiones[ev.datos.perfil] = { texto: ev.datos.texto, por: ev.datos.participante, en: ev.en };
      break;
    case 'apertura.marca':
      conMesa().apertura.equivalencia[ev.datos.perfil] = ev.datos.valor;
      break;
    case 'apertura.ajustes':
      conMesa().apertura.ajustes = ev.datos.texto;
      break;
    case 'termino.guardado':
      conMesa().glosario = reemplazarPorId(conMesa().glosario, ev.datos.termino);
      break;
    case 'necesidad.guardada':
      conMesa().necesidades = reemplazarPorId(conMesa().necesidades, ev.datos.necesidad);
      break;
    case 'tarjeta.guardada':
      conMesa().tarjetas = reemplazarPorId(conMesa().tarjetas, ev.datos.tarjeta);
      break;
    case 'i2a.marcada':
      conMesa().i2a[ev.datos.tarjetaId] = { revision: ev.datos.revision, nota: ev.datos.nota };
      break;
    case 'i2b.marcada': {
      const m = conMesa();
      m.i2b[ev.datos.campo] = ev.datos.valor;
      if (ev.datos.campo === 'B1') m.i2b.obsB1 = ev.datos.obs;
      else m.i2b.obsB2 = ev.datos.obs;
      break;
    }
    case 'esperado.escrito':
      conMesa().esperadosPorNecesidad[ev.datos.necesidadId] = ev.datos.texto;
      break;
    case 'i2c.marcada': {
      const m = conMesa();
      const fila = m.i2c[ev.datos.tarjetaId] ?? { esperado: '' };
      fila[ev.datos.campo] = ev.datos.valor;
      if (ev.datos.divergenciaId) fila.divergenciaId = ev.datos.divergenciaId;
      m.i2c[ev.datos.tarjetaId] = fila;
      break;
    }
    case 'divergencia.guardada':
      conMesa().divergencias = reemplazarPorId(conMesa().divergencias, ev.datos.divergencia);
      break;
    case 'validacion06.guardada':
      conMesa().validacion06 = { ...ev.datos };
      break;
    case 'ronda.lanzada':
      for (const m of Object.values(s.mesas)) {
        if (m.rondas.some((r) => r.numero === ev.datos.numero)) continue;
        const plan = m.planI3.find((p) => p.numero === ev.datos.numero);
        m.rondas.push({
          numero: ev.datos.numero, lanzadaEn: ev.en, items: (plan?.items ?? []).map((i) => ({ ...i })),
          respuestas: {}, resultados: {},
        });
      }
      break;
    case 'ronda.item.cambiado': {
      const plan = conMesa().planI3.find((p) => p.numero === ev.datos.numero);
      if (plan) plan.items = plan.items.map((i) => (i.id === ev.datos.itemId ? { ...ev.datos.item } : i));
      break;
    }
    case 'ronda.respondida': {
      const r = conMesa().rondas.find((x) => x.numero === ev.datos.numero);
      if (r) r.respuestas[ev.datos.itemId] = { ...r.respuestas[ev.datos.itemId], [ev.datos.participante]: ev.datos.texto };
      break;
    }
    case 'ronda.revelada': {
      const r = conMesa().rondas.find((x) => x.numero === ev.datos.numero);
      if (r && r.reveladaEn === undefined) r.reveladaEn = ev.en;
      break;
    }
    case 'ronda.repetida': {
      // Vuelve a empezar en esa mesa; las divergencias que ya creó siguen en 06.
      const r = conMesa().rondas.find((x) => x.numero === ev.datos.numero);
      if (r) {
        r.lanzadaEn = ev.en;
        r.respuestas = {};
        r.resultados = {};
        delete r.reveladaEn;
      }
      break;
    }
    case 'ronda.marcada': {
      const r = conMesa().rondas.find((x) => x.numero === ev.datos.numero);
      if (r) {
        r.resultados[ev.datos.itemId] = {
          resultado: ev.datos.resultado, marcadoPor: ev.datos.participante,
          ...(ev.datos.divergenciaId ? { divergenciaId: ev.datos.divergenciaId } : {}),
        };
      }
      break;
    }
    case 'chequeos.marcados':
      conMesa().chequeosBloque = { c5: ev.datos.c5, c6: ev.datos.c6, obs: ev.datos.obs };
      break;
    case 'lineabase.congelada': {
      const m = conMesa();
      if (m.lineaBase.congeladaEn === undefined) {
        m.lineaBase.congeladaEn = ev.en;
        m.lineaBase.congeladaPor = ev.datos.por;
        m.lineaBase.instantanea = structuredClone({ tarjetas: m.tarjetas, glosario: m.glosario });
      }
      break;
    }
    case 'evidencia.marcada':
      conMesa().lineaBase.evidencias[ev.datos.evidencia] = { resultado: ev.datos.resultado, nota: ev.datos.nota };
      break;
    case 'traspaso.asignado': {
      const m = conMesa();
      m.traspaso.lectorId = ev.datos.lectorId ?? undefined;
      m.traspaso.lectorMesa = ev.datos.lectorMesa ?? undefined;
      break;
    }
    case 'traspaso.reconstruido': {
      const m = conMesa();
      const previo = m.traspaso.items[ev.datos.tarjetaId];
      m.traspaso.items[ev.datos.tarjetaId] = { ...(previo ?? { correccion: '' }), reconstruccion: ev.datos.texto };
      break;
    }
    case 'traspaso.confirmado': {
      const m = conMesa();
      const previo = m.traspaso.items[ev.datos.tarjetaId] ?? { reconstruccion: '', correccion: '' };
      m.traspaso.items[ev.datos.tarjetaId] = { ...previo, coincide: ev.datos.coincide, correccion: ev.datos.correccion };
      break;
    }
    case 'accion.guardada': {
      const m = conMesa();
      if (ev.datos.indice !== undefined && m.acciones[ev.datos.indice]) m.acciones[ev.datos.indice] = { ...ev.datos.accion };
      else m.acciones.push({ ...ev.datos.accion });
      break;
    }
    case 'destape.marcado':
      conMesa().destape[ev.datos.divergencia] = ev.datos.registrada;
      break;
    case 'cuestionario.respondido': {
      const d = ev.datos;
      s.cuestionario[d.participante] = {
        afirmaciones: [...d.afirmaciones], tlx: [...d.tlx], abierta: d.abierta,
        ...(d.utilidad ? { utilidad: { respuestas: { ...d.utilidad.respuestas }, abierta: d.utilidad.abierta } } : {}),
      };
      break;
    }
    case 'entrevista.nota': {
      const otras = s.entrevista.filter((n) => n.pregunta !== ev.datos.pregunta);
      s.entrevista = [...otras, { pregunta: ev.datos.pregunta, texto: ev.datos.texto }].sort((a, b) => a.pregunta - b.pregunta);
      break;
    }
    case 'plantilla.reabierta': {
      const m = conMesa();
      if (!m.reabiertos.includes(ev.datos.tramo)) m.reabiertos.push(ev.datos.tramo);
      break;
    }
    case 'sesion.cerrada':
      s.estado = 'cerrada';
      break;
    case 'conexion':
      if (s.participantes[ev.datos.participante]) s.participantes[ev.datos.participante].conectado = ev.datos.conectado;
      break;
  }
  return s;
}

export function reconstruir(eventos: Evento[]): EstadoDeSesion {
  const estado = eventos.reduce<EstadoDeSesion | null>(aplicarEvento, null);
  if (!estado) throw new Error('No hay eventos para reconstruir la sesión');
  return estado;
}

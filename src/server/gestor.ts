import type { Comando } from '../shared/comandos.js';
import type { Contenido } from '../shared/contenido.js';
import type { Actor, Evento, EventoSinSeq } from '../shared/eventos.js';
import { idAzar } from '../shared/ids.js';
import { ubicarTarde } from '../shared/mesas.js';
import { inscripcionCerrada } from '../shared/permisos.js';
import { aplicarEvento, reconstruir } from '../shared/reductor.js';
import type { EstadoDeSesion } from '../shared/tipos.js';
import type { Almacen } from './almacen.js';
import { procesarComando } from './procesar.js';
import { revisarReloj } from './reloj.js';

const MAX_APODO = 30;

export class GestorSesiones {
  private estados = new Map<string, EstadoDeSesion>();
  private registros = new Map<string, Evento[]>();
  private opIds = new Map<string, Set<string>>();
  private oyentes = new Set<(sesionId: string) => void>();
  private errores: { id: string; mensaje: string }[] = [];
  readonly ahora: () => number;
  private readonly azar: () => number;

  constructor(private readonly o: { almacen: Almacen; contenidoBase: Contenido; ahora?: () => number; azar?: () => number }) {
    this.ahora = o.ahora ?? Date.now;
    this.azar = o.azar ?? Math.random;
  }

  // Cada sesión se carga por separado: una que no se pueda reconstruir no impide abrir las demás.
  cargar(): void {
    for (const id of this.o.almacen.sesiones()) {
      try {
        const eventos = this.o.almacen.leer(id);
        if (eventos.length === 0) continue;
        this.estados.set(id, reconstruir(eventos));
        this.registros.set(id, eventos);
        this.opIds.set(id, new Set(eventos.map((e) => e.opId).filter((x): x is string => Boolean(x))));
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        console.error(`[tomatera] no se pudo cargar la sesión ${id}: ${mensaje}`);
        this.errores.push({ id, mensaje });
      }
    }
  }

  erroresDeCarga(): { id: string; mensaje: string }[] {
    return [...this.errores];
  }

  // Primero se calcula el estado nuevo; después se escribe todo el comando de una vez; al final se confirma.
  private guardar(sesionId: string, eventos: EventoSinSeq[]): void {
    let estado = this.estados.get(sesionId) ?? null;
    const nuevos: Evento[] = [];
    for (const ev of eventos) {
      const e = { ...ev, seq: (estado?.ultimoSeq ?? 0) + 1 } as Evento;
      estado = aplicarEvento(estado, e);
      nuevos.push(e);
    }
    this.o.almacen.agregarVarios(sesionId, nuevos);
    if (estado) this.estados.set(sesionId, estado);
    const registro = this.registros.get(sesionId) ?? [];
    registro.push(...nuevos);
    this.registros.set(sesionId, registro);
  }

  private avisar(sesionId: string): void {
    for (const cb of this.oyentes) cb(sesionId);
  }

  crear(o: { prueba: boolean; velocidad: number }): EstadoDeSesion {
    const enUso = new Set([...this.estados.values()].filter((s) => s.estado !== 'terminada').map((s) => s.codigo));
    // Un código al azar y, si ya está en uso, el siguiente libre (así también termina con un azar fijo).
    let codigo = String(Math.floor(100000 + this.azar() * 900000));
    while (enUso.has(codigo)) codigo = String(((Number(codigo) - 100000 + 1) % 900000) + 100000);
    const id = idAzar(9);
    this.opIds.set(id, new Set());
    this.guardar(id, [{
      en: this.ahora(), por: { tipo: 'autores' }, tipo: 'sesion.creada',
      datos: { id, codigo, prueba: o.prueba, velocidad: o.velocidad, contenido: structuredClone(this.o.contenidoBase) },
    }]);
    this.avisar(id);
    return this.estados.get(id) as EstadoDeSesion;
  }

  // El contenido con el que se crean las sesiones nuevas (las existentes guardan su propia copia).
  get contenidoBase(): Contenido {
    return this.o.contenidoBase;
  }

  estado(sesionId: string): EstadoDeSesion | undefined {
    return this.estados.get(sesionId);
  }

  listar(): EstadoDeSesion[] {
    return [...this.estados.values()].sort((a, b) => b.creadaEn - a.creadaEn);
  }

  porCodigo(codigo: string): EstadoDeSesion | undefined {
    return this.listar().find((s) => s.codigo === codigo && s.estado !== 'terminada');
  }

  unirse(codigo: string, apodo: string | undefined, consentimiento: boolean, bot = false):
    { sesionId: string; participanteId: string; clave: string } | { error: string } {
    if (!consentimiento) return { error: 'Hay que aceptar el consentimiento para participar' };
    const s = this.porCodigo(String(codigo).trim());
    if (!s) return { error: 'Código de sesión incorrecto' };
    if (s.estado === 'cerrada') return { error: 'La sesión ya terminó' };
    const id = idAzar(12);
    // El identificador lo ven los compañeros de mesa; para entrar como esa persona hace falta además la clave.
    const clave = idAzar(18);
    const limpio = apodo?.trim().slice(0, MAX_APODO) || undefined;
    const por: Actor = { tipo: 'sistema' };
    const en = this.ahora();
    const eventos: EventoSinSeq[] = [];
    if (!inscripcionCerrada(s)) {
      eventos.push({ en, por, tipo: 'participante.unido', datos: { id, apodo: limpio, bot, clave } });
    } else {
      const lugar = ubicarTarde(Object.values(s.mesas));
      if (!lugar) {
        eventos.push({ en, por, tipo: 'participante.unido', datos: { id, apodo: limpio, bot, clave, mesa: null, roles: [], espectador: true } });
      } else {
        if (lugar.liberar) {
          eventos.push({ en, por, tipo: 'participante.movido', datos: { id: lugar.liberar.id, mesa: lugar.mesa, roles: lugar.liberar.roles } });
        }
        eventos.push({ en, por, tipo: 'participante.unido', datos: { id, apodo: limpio, bot, clave, mesa: lugar.mesa, roles: lugar.roles } });
      }
    }
    this.guardar(s.id, eventos);
    this.avisar(s.id);
    return { sesionId: s.id, participanteId: id, clave };
  }

  ejecutar(sesionId: string, actor: Actor, c: Comando): { ok: true } | { ok: false; error: string } {
    const s = this.estados.get(sesionId);
    if (!s) return { ok: false, error: 'La sesión no existe' };
    const vistos = this.opIds.get(sesionId) as Set<string>;
    if (c.opId && vistos.has(c.opId)) return { ok: true };
    const r = procesarComando(s, actor, c, this.ahora(), this.azar);
    if (!r.ok) return r;
    this.guardar(sesionId, r.eventos);
    if (c.opId) vistos.add(c.opId);
    this.avisar(sesionId);
    return { ok: true };
  }

  registrarConexion(sesionId: string, participanteId: string, conectado: boolean): void {
    const s = this.estados.get(sesionId);
    const p = s?.participantes[participanteId];
    if (!p || p.conectado === conectado) return;
    this.guardar(sesionId, [{ en: this.ahora(), por: { tipo: 'sistema' }, tipo: 'conexion', datos: { participante: participanteId, conectado } }]);
    this.avisar(sesionId);
  }

  tick(): void {
    const ahora = this.ahora();
    for (const [id, s] of this.estados) {
      const eventos = revisarReloj(s, ahora);
      if (eventos.length === 0) continue;
      this.guardar(id, eventos);
      this.avisar(id);
    }
  }

  alCambiar(cb: (sesionId: string) => void): () => void {
    this.oyentes.add(cb);
    return () => this.oyentes.delete(cb);
  }

  eventos(sesionId: string): Evento[] {
    return this.registros.get(sesionId) ?? [];
  }
}

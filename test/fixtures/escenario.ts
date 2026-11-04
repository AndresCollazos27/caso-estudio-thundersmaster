import type { Contenido } from '../../src/shared/contenido.js';
import type { Actor, Evento, EventoSinSeq } from '../../src/shared/eventos.js';
import { idAzar } from '../../src/shared/ids.js';
import { aplicarEvento } from '../../src/shared/reductor.js';
import type { EstadoDeSesion } from '../../src/shared/tipos.js';
import { TRAMOS, type Rol, type TramoId } from '../../src/shared/valores.js';
import { procesarComando } from '../../src/server/procesar.js';
import type { TipoComando } from '../../src/shared/comandos.js';
import { contenidoMinimo } from './contenido.js';

export const T0 = 1_800_000_000_000;

// Una sesión armada con los mismos comandos y eventos que usa el servidor.
export class Escenario {
  estado!: EstadoDeSesion;
  ahora = T0;
  private seq = 0;

  constructor(n = 6, contenido: Contenido = contenidoMinimo(), cerrar = true) {
    this.aplicar({ en: this.ahora, tipo: 'sesion.creada', por: { tipo: 'autores' }, datos: { id: 's1', codigo: '123456', prueba: true, velocidad: 1, contenido } });
    for (let i = 1; i <= n; i++) this.aplicar({ en: this.ahora, tipo: 'participante.unido', por: { tipo: 'sistema' }, datos: { id: `p${i}`, bot: false } });
    if (cerrar) this.ok('leandro', 'cerrarInscripcion');
  }

  aplicar(e: EventoSinSeq): void {
    this.estado = aplicarEvento(this.estado ?? null, { ...e, seq: ++this.seq } as Evento);
  }

  actor(quien: string): Actor {
    if (quien === 'leandro') return { tipo: 'leandro' };
    if (quien === 'autores') return { tipo: 'autores' };
    return { tipo: 'participante', id: quien, roles: this.estado.participantes[quien].roles };
  }

  ejecutar(quien: string, tipo: TipoComando, datos: unknown = {}, opId = idAzar()) {
    const r = procesarComando(this.estado, this.actor(quien), { opId, tipo, datos }, this.ahora, () => 0);
    if (r.ok) for (const e of r.eventos) this.aplicar(e);
    return r;
  }

  ok(quien: string, tipo: TipoComando, datos: unknown = {}) {
    const r = this.ejecutar(quien, tipo, datos);
    if (!r.ok) throw new Error(`${tipo} falló: ${r.error}`);
    return r.eventos;
  }

  irA(tramo: TramoId): void {
    this.aplicar({ en: this.ahora, tipo: 'tramo.iniciado', por: { tipo: 'sistema' }, datos: { indice: TRAMOS.indexOf(tramo) } });
  }

  quien(rol: Rol, mesa = 1): string {
    const m = this.estado.mesas[mesa];
    const id = Object.keys(m.miembros).find((p) => m.miembros[p].includes(rol));
    if (!id) throw new Error(`No hay ${rol} en la mesa ${mesa}`);
    return id;
  }
}

import { io, type Socket } from 'socket.io-client';
import type { TipoComando } from '../shared/comandos.js';
import { idAzar } from '../shared/ids.js';

export type Respuesta = { ok: true } | { ok: false; error: string };

export type Auth =
  | { tipo: 'jugador'; sesionId: string; participanteId: string; clave: string }
  | { tipo: 'leandro'; k: string; sesionId?: string }
  | { tipo: 'autores'; k: string; sesionId?: string };

export interface EstadoConexion {
  vista: unknown;
  conectado: boolean;
  error: string | null;
}

export interface Conexion {
  vista(): unknown;
  estado(): EstadoConexion;
  alCambiar(cb: () => void): () => void;
  enviar(tipo: TipoComando, datos?: unknown): Promise<Respuesta>;
  // Para los eventos propios de los autores (crearSesion, listarSesiones, seleccionar, simular).
  emitir<T>(evento: string, datos?: unknown): Promise<T>;
  escuchar(evento: string, cb: (datos: unknown) => void): () => void;
  conectado(): boolean;
  desfaseMs(): number;
  cerrar(): void;
}

// Por http no hay crypto.randomUUID: se usa getRandomValues, que sí existe.
export const nuevoOpId = (): string => idAzar(12);

export const calcularDesfase = (ahoraServidor: number, ahoraLocal: number): number => ahoraServidor - ahoraLocal;

const ESPERA_ACK_MS = 6000;
const INTENTOS = 3;

export function crearConexion(auth: Auth): Conexion {
  const socket: Socket = io({ auth, reconnectionDelayMax: 4000 });
  let estado: EstadoConexion = { vista: null, conectado: false, error: null };
  let desfase = 0;
  const oyentes = new Set<() => void>();
  const cambiar = (parcial: Partial<EstadoConexion>) => {
    estado = { ...estado, ...parcial };
    for (const cb of oyentes) cb();
  };

  socket.on('connect', () => cambiar({ conectado: true, error: null }));
  socket.on('disconnect', () => cambiar({ conectado: false }));
  socket.on('connect_error', (e: Error) => cambiar({ conectado: false, error: e.message }));
  socket.on('vista', (vista: { sesion?: { ahoraServidor?: number } }) => {
    if (vista.sesion?.ahoraServidor) desfase = calcularDesfase(vista.sesion.ahoraServidor, Date.now());
    cambiar({ vista });
  });

  return {
    vista: () => estado.vista,
    estado: () => estado,
    alCambiar(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    async enviar(tipo, datos = {}) {
      // Si no llega respuesta se reintenta con el mismo opId: el servidor no lo aplica dos veces.
      const comando = { opId: nuevoOpId(), tipo, datos };
      for (let i = 0; i < INTENTOS; i++) {
        try {
          return (await socket.timeout(ESPERA_ACK_MS).emitWithAck('comando', comando)) as Respuesta;
        } catch {
          // Sin respuesta a tiempo.
        }
      }
      return { ok: false, error: 'No hay conexión con el servidor; inténtalo de nuevo' };
    },
    emitir: <T,>(evento: string, datos: unknown = {}) => socket.timeout(ESPERA_ACK_MS).emitWithAck(evento, datos) as Promise<T>,
    escuchar(evento, cb) {
      socket.on(evento, cb);
      return () => socket.off(evento, cb);
    },
    conectado: () => socket.connected,
    desfaseMs: () => desfase,
    cerrar: () => socket.disconnect(),
  };
}

// Lo que queda del tramo, en ms, contado con la hora del servidor.
export function restanteAhora(restanteMs: number, ahoraServidor: number, pausada: boolean, desfaseMs: number, ahoraLocal = Date.now()): number {
  if (pausada) return restanteMs;
  return restanteMs - (ahoraLocal + desfaseMs - ahoraServidor);
}

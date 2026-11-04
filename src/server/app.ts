import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { Comando, TipoComando } from '../shared/comandos.js';
import type { Actor } from '../shared/eventos.js';
import type { EstadoDeSesion } from '../shared/tipos.js';
import { vistaAutores, vistaJugador, vistaLeandro } from '../shared/vistas.js';
import { exportarSesion, nombreExportacion } from './exportar.js';
import type { GestorSesiones } from './gestor.js';
import { reanudarSimulados, simular, type Simulador } from './simulador.js';

export interface OpcionesApp {
  gestor: GestorSesiones;
  hostToken: string;
  adminToken: string;
  publicUrl: string;
  dirCliente: string | null;
  ahora?: () => number;
}

interface Cliente {
  socket: Socket;
  tipo: 'jugador' | 'leandro' | 'autores';
  sesionId: string | null;
  participanteId?: string;
  // La última vista enviada, sin la hora: si no cambió, no se vuelve a mandar.
  huella?: string;
}

// La hora del servidor y lo que queda del tramo cambian siempre; el celular los calcula solo entre vista y vista.
const huellaDe = (vista: unknown) => JSON.stringify(vista, (k, v) => (k === 'ahoraServidor' || k === 'restanteMs' ? undefined : v));

// Compara claves sin delatar por el tiempo cuántos caracteres coinciden.
function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const FALLOS_MAXIMOS = 5;
const VENTANA_MS = 60_000;
const RETRASO_VISTA_MS = 100;
const MAX_SIMULADOS = 45;

export function resumenSesion(s: EstadoDeSesion) {
  return {
    id: s.id, codigo: s.codigo, prueba: s.prueba, velocidad: s.velocidad, creadaEn: s.creadaEn, estado: s.estado,
    inscritos: Object.keys(s.participantes).length,
  };
}

export function crearApp(o: OpcionesApp) {
  const ahora = o.ahora ?? Date.now;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Los fallos de las dos rutas que reciben un código se cuentan juntos, para que nadie adivine códigos.
  const fallos = new Map<string, { n: number; desde: number }>();
  const vigente = (ip: string) => {
    const f = fallos.get(ip);
    return f && ahora() - f.desde < VENTANA_MS ? f : undefined;
  };
  const anotarFallo = (ip: string) => {
    const f = vigente(ip) ?? { n: 0, desde: ahora() };
    f.n += 1;
    fallos.set(ip, f);
  };
  // En el aula todos los celulares salen por la misma IP pública: el código de una sesión abierta entra siempre,
  // y solo se frenan los códigos que no existen.
  const limitar = (codigoDe: (req: express.Request) => unknown): express.RequestHandler => (req, res, next) => {
    if (o.gestor.porCodigo(String(codigoDe(req) ?? '').trim())) return next();
    if ((vigente(req.ip ?? '')?.n ?? 0) >= FALLOS_MAXIMOS) return void res.status(429).json({ error: 'Demasiados intentos; espera un minuto' });
    next();
  };

  app.get('/api/sesion', limitar((req) => req.query.c), (req, res) => {
    const s = o.gestor.porCodigo(String(req.query.c ?? ''));
    if (!s) {
      anotarFallo(req.ip ?? '');
      return void res.status(404).json({ error: 'Código de sesión incorrecto' });
    }
    res.json({ caso: s.contenido.caso, consentimiento: s.contenido.consentimiento, estado: s.estado });
  });

  app.post('/api/unirse', limitar((req) => req.body?.codigo), (req, res) => {
    const { codigo, apodo, consentimiento } = (req.body ?? {}) as Record<string, unknown>;
    const r = o.gestor.unirse(String(codigo ?? ''), typeof apodo === 'string' ? apodo : undefined, consentimiento === true);
    if ('error' in r) {
      // Solo cuenta como intento fallido un código que no existe (no, por ejemplo, olvidar el consentimiento).
      if (!o.gestor.porCodigo(String(codigo ?? '').trim())) anotarFallo(req.ip ?? '');
      return void res.status(400).json(r);
    }
    res.json(r);
  });

  // Para las versiones impresas: el contenido completo (con las cartas) solo sale con la clave de autores.
  app.get('/api/autores/contenido', (req, res) => {
    if (req.query.k !== o.adminToken) return void res.status(403).json({ error: 'Clave incorrecta' });
    const s = req.query.s ? o.gestor.estado(String(req.query.s)) : undefined;
    if (req.query.s && !s) return void res.status(404).json({ error: 'La sesión no existe' });
    res.json({
      contenido: s?.contenido ?? o.gestor.contenidoBase,
      sesion: s ? { codigo: s.codigo, enlace: `${o.publicUrl}/?c=${s.codigo}` } : null,
    });
  });

  app.get('/api/autores/exportar', (req, res) => {
    if (req.query.k !== o.adminToken) return void res.status(403).json({ error: 'Clave incorrecta' });
    const s = o.gestor.estado(String(req.query.s ?? ''));
    if (!s) return void res.status(404).json({ error: 'La sesión no existe' });
    res.attachment(nombreExportacion(s.codigo, new Date(ahora())));
    res.json(exportarSesion(s, o.gestor.eventos(s.id)));
  });

  const http = createServer(app);
  // Las vistas son JSON repetitivo: comprimidas pesan varias veces menos en el wifi del aula.
  const io = new Server(http, { serveClient: false, maxHttpBufferSize: 64 * 1024, perMessageDeflate: { threshold: 1024 } });
  const porSesion = new Map<string, Set<Cliente>>();
  const autores = new Set<Cliente>();
  const simuladores: Simulador[] = [];
  // Si el servidor se reinició, los simulados de las sesiones de prueba siguen solos.
  for (const s of o.gestor.listar()) {
    if (s.prueba && s.estado !== 'terminada' && Object.values(s.participantes).some((p) => p.bot)) {
      simuladores.push(reanudarSimulados(o.gestor, s.id, { semilla: Math.floor(Math.random() * 2 ** 31) }));
    }
  }

  const registrar = (c: Cliente) => {
    if (!c.sesionId) return;
    if (!porSesion.has(c.sesionId)) porSesion.set(c.sesionId, new Set());
    porSesion.get(c.sesionId)!.add(c);
  };
  const quitar = (c: Cliente) => {
    if (c.sesionId) porSesion.get(c.sesionId)?.delete(c);
  };

  // Las sesiones que no se pudieron cargar también aparecen, con su error, para que los autores lo vean.
  const listaSesiones = () => [
    ...o.gestor.listar().map(resumenSesion),
    ...o.gestor.erroresDeCarga().map((x) => ({ id: x.id, codigo: '—', prueba: true, velocidad: 1, creadaEn: 0, estado: `error: ${x.mensaje}`, inscritos: 0 })),
  ];

  function enviar(c: Cliente): void {
    if (!c.sesionId) return;
    const estado = o.gestor.estado(c.sesionId);
    if (!estado) return;
    const t = ahora();
    let vista: unknown = null;
    if (c.tipo === 'jugador' && c.participanteId) vista = vistaJugador(estado, c.participanteId, t);
    if (c.tipo === 'leandro') vista = vistaLeandro(estado, t, o.publicUrl);
    if (c.tipo === 'autores') {
      // Los autores reciben el enlace secreto de Leandro para mandárselo; nunca se proyecta.
      vista = {
        ...vistaAutores(estado, t), registro: o.gestor.eventos(c.sesionId).slice(-50), enlaceBase: o.publicUrl,
        enlaceLeandro: `${o.publicUrl}/leandro?k=${encodeURIComponent(o.hostToken)}`,
      };
    }
    if (vista === null) return;
    const huella = huellaDe(vista);
    if (huella === c.huella) return;
    c.huella = huella;
    c.socket.emit('vista', vista);
  }

  const pendientes = new Map<string, NodeJS.Timeout>();
  const quitarOyente = o.gestor.alCambiar((sesionId) => {
    if (pendientes.has(sesionId)) return;
    pendientes.set(sesionId, setTimeout(() => {
      pendientes.delete(sesionId);
      for (const c of porSesion.get(sesionId) ?? []) enviar(c);
      for (const c of autores) c.socket.emit('sesiones', listaSesiones());
    }, RETRASO_VISTA_MS));
  });

  io.use((socket, next) => {
    const a = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    if (a.tipo === 'jugador') {
      const s = o.gestor.estado(String(a.sesionId ?? ''));
      const p = s?.participantes[String(a.participanteId ?? '')];
      // El identificador lo conocen los compañeros de mesa: además hace falta la clave que se recibió al unirse.
      // Las sesiones de antes de las claves se aceptan solo con el identificador.
      const valida = p && (p.clave === undefined || (typeof a.clave === 'string' && iguales(a.clave, p.clave)));
      if (!s || !p || !valida) return next(new Error('Sesión o participante desconocido'));
      socket.data.cliente = { tipo: 'jugador', sesionId: s.id, participanteId: p.id };
      return next();
    }
    if (a.tipo === 'leandro') {
      if (typeof a.k !== 'string' || !iguales(a.k, o.hostToken)) return next(new Error('Clave incorrecta'));
      const s = a.sesionId ? o.gestor.estado(String(a.sesionId)) : o.gestor.listar().find((x) => !x.prueba) ?? o.gestor.listar()[0];
      if (!s) return next(new Error('Todavía no hay ninguna sesión creada'));
      socket.data.cliente = { tipo: 'leandro', sesionId: s.id };
      return next();
    }
    if (a.tipo === 'autores') {
      if (typeof a.k !== 'string' || !iguales(a.k, o.adminToken)) return next(new Error('Clave incorrecta'));
      socket.data.cliente = { tipo: 'autores', sesionId: a.sesionId ? String(a.sesionId) : null };
      return next();
    }
    next(new Error('Tipo de conexión desconocido'));
  });

  io.on('connection', (socket) => {
    const c: Cliente = { socket, ...(socket.data.cliente as Omit<Cliente, 'socket'>) };
    registrar(c);
    if (c.tipo === 'jugador') o.gestor.registrarConexion(c.sesionId as string, c.participanteId as string, true);
    if (c.tipo === 'autores') {
      autores.add(c);
      socket.emit('sesiones', listaSesiones());
    }
    enviar(c);

    socket.on('comando', (cmd: Partial<Comando> | undefined, ack?: (r: unknown) => void) => {
      try {
        if (!c.sesionId) return ack?.({ ok: false, error: 'Elige una sesión' });
        const estado = o.gestor.estado(c.sesionId);
        if (!estado) return ack?.({ ok: false, error: 'La sesión no existe' });
        const actor: Actor = c.tipo === 'jugador'
          ? { tipo: 'participante', id: c.participanteId as string, roles: estado.participantes[c.participanteId as string]?.roles ?? [] }
          : { tipo: c.tipo };
        const comando: Comando = { opId: String(cmd?.opId ?? ''), tipo: String(cmd?.tipo ?? '') as TipoComando, datos: cmd?.datos };
        ack?.(o.gestor.ejecutar(c.sesionId, actor, comando));
      } catch (e) {
        console.error('[tomatera] error al procesar un comando', e);
        ack?.({ ok: false, error: 'Error interno del servidor; avisa a los autores' });
      }
    });

    if (c.tipo === 'autores') {
      socket.on('crearSesion', (d: { prueba?: boolean; velocidad?: number } | undefined, ack?: (r: unknown) => void) => {
        const velocidad = [1, 10, 60].includes(Number(d?.velocidad)) ? Number(d?.velocidad) : 1;
        const s = o.gestor.crear({ prueba: Boolean(d?.prueba), velocidad });
        ack?.({ ok: true, sesionId: s.id });
      });
      socket.on('listarSesiones', (_d: unknown, ack?: (r: unknown) => void) => ack?.(listaSesiones()));
      socket.on('simular', (d: { sesionId?: string; n?: number } | undefined, ack?: (r: unknown) => void) => {
        const s = o.gestor.estado(String(d?.sesionId ?? ''));
        if (!s) return ack?.({ ok: false, error: 'La sesión no existe' });
        if (!s.prueba) return ack?.({ ok: false, error: 'Solo se puede simular en una sesión de prueba' });
        const n = Number(d?.n);
        if (!Number.isInteger(n) || n < 1 || n > MAX_SIMULADOS) return ack?.({ ok: false, error: `Elige entre 1 y ${MAX_SIMULADOS} participantes` });
        try {
          simuladores.push(simular(o.gestor, s.id, n, { semilla: Math.floor(Math.random() * 2 ** 31) }));
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : 'No se pudo simular' });
        }
      });
      socket.on('seleccionar', (d: { sesionId?: string } | undefined, ack?: (r: unknown) => void) => {
        const id = String(d?.sesionId ?? '');
        if (!o.gestor.estado(id)) return ack?.({ ok: false, error: 'La sesión no existe' });
        quitar(c);
        c.sesionId = id;
        c.huella = undefined;
        registrar(c);
        enviar(c);
        ack?.({ ok: true });
      });
    }

    socket.on('disconnect', () => {
      quitar(c);
      autores.delete(c);
      if (c.tipo === 'jugador' && c.sesionId && c.participanteId) {
        const sigue = [...(porSesion.get(c.sesionId) ?? [])].some((x) => x.participanteId === c.participanteId);
        if (!sigue) o.gestor.registrarConexion(c.sesionId, c.participanteId, false);
      }
    });
  });

  if (o.dirCliente && existsSync(o.dirCliente)) {
    const dir = o.dirCliente;
    app.use(express.static(dir, { index: false }));
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => res.sendFile(join(dir, 'index.html')));
  }

  return {
    http,
    io,
    // El reloj del servidor: lo llama index.ts cada 500 ms. Los simulados actúan después del reloj.
    tick: () => {
      o.gestor.tick();
      for (const s of simuladores) s.paso();
    },
    cerrar: () => new Promise<void>((r) => {
      quitarOyente();
      for (const t of pendientes.values()) clearTimeout(t);
      io.close(() => r());
    }),
  };
}

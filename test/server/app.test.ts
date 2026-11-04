import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as conectar, type Socket } from 'socket.io-client';
import { Almacen } from '../../src/server/almacen.js';
import { crearApp } from '../../src/server/app.js';
import { GestorSesiones } from '../../src/server/gestor.js';
import { simular } from '../../src/server/simulador.js';
import { contenidoMinimo } from '../fixtures/contenido.js';

describe('servidor', () => {
  let base: string;
  let gestor: GestorSesiones;
  let cerrar: () => Promise<void>;
  let tick: () => void;
  let io: ReturnType<typeof crearApp>["io"];
  const abiertos: Socket[] = [];

  beforeEach(async () => {
    gestor = new GestorSesiones({ almacen: new Almacen(mkdtempSync(join(tmpdir(), 'tomatera-app-'))), contenidoBase: contenidoMinimo() });
    const app = crearApp({ gestor, hostToken: 'clave-leandro', adminToken: 'clave-autores', publicUrl: 'http://203.0.113.24:8090', dirCliente: null });
    await new Promise<void>((r) => app.http.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
    cerrar = app.cerrar;
    tick = app.tick;
    io = app.io;
  });

  afterEach(async () => {
    for (const s of abiertos.splice(0)) s.disconnect();
    await cerrar();
  });

  const unirse = (codigo: string, consentimiento = true) =>
    fetch(`${base}/api/unirse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo, apodo: 'Ana', consentimiento }) });

  function socket(auth: Record<string, unknown>): Socket {
    const s = conectar(base, { auth, transports: ['websocket'], reconnection: false });
    abiertos.push(s);
    return s;
  }

  const primera = <T>(s: Socket, evento: string) => new Promise<T>((r) => s.once(evento, r));

  it('POST /api/unirse devuelve el participante', async () => {
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const r = await unirse(s.codigo);
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.sesionId).toBe(s.id);
    expect(gestor.estado(s.id)?.participantes[cuerpo.participanteId]).toBeDefined();
  });

  it('para entrar como jugador hace falta la clave que se recibió al unirse, no solo el identificador', async () => {
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const { participanteId, clave } = await (await unirse(s.codigo)).json();
    expect(clave).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const sinClave = socket({ tipo: 'jugador', sesionId: s.id, participanteId });
    expect((await primera<Error>(sinClave, 'connect_error')).message).toBe('Sesión o participante desconocido');
    const otraClave = socket({ tipo: 'jugador', sesionId: s.id, participanteId, clave: 'adivinada' });
    expect((await primera<Error>(otraClave, 'connect_error')).message).toBe('Sesión o participante desconocido');
    const bien = socket({ tipo: 'jugador', sesionId: s.id, participanteId, clave });
    expect(await primera<{ tipo: string }>(bien, 'vista')).toMatchObject({ tipo: 'jugador' });
  });

  it('el jugador recibe su vista y un comando responde ok en el ack', async () => {
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const { participanteId, clave } = await (await unirse(s.codigo)).json();
    const cliente = socket({ tipo: 'jugador', sesionId: s.id, participanteId, clave });
    const vista = await primera<{ tipo: string; yo: { id: string } }>(cliente, 'vista');
    expect(vista).toMatchObject({ tipo: 'jugador', yo: { id: participanteId } });
    const ack = await cliente.emitWithAck('comando', { opId: 'x1', tipo: 'leerCarta', datos: {} });
    expect(ack).toEqual({ ok: false, error: 'Espera a que se armen las mesas' });
  });

  it('al cerrar la inscripción el jugador recibe una vista con su mesa y su comando responde ok', async () => {
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const unidos: { participanteId: string; clave: string }[] = [];
    for (let i = 0; i < 6; i++) unidos.push(await (await unirse(s.codigo)).json());
    const cliente = socket({ tipo: 'jugador', sesionId: s.id, ...unidos[0] });
    await primera(cliente, 'vista');
    const conMesa = new Promise<{ yo: { mesa: number | null; roles: string[] } }>((r) =>
      cliente.on('vista', (v) => { if (v.yo.mesa !== null) r(v); }));
    const leandro = socket({ tipo: 'leandro', k: 'clave-leandro', sesionId: s.id });
    expect(await leandro.emitWithAck('comando', { opId: 'c1', tipo: 'cerrarInscripcion', datos: {} })).toEqual({ ok: true });
    const vista = await conMesa;
    expect(vista.yo.mesa).toBe(1);
    expect(vista.yo.roles).toHaveLength(1);
    expect(await cliente.emitWithAck('comando', { opId: 'x2', tipo: 'leerCarta', datos: {} })).toEqual({ ok: true });
  });

  it('un cambio en otra mesa no le vuelve a mandar la vista a quien no le cambió nada, y los mensajes van comprimidos', async () => {
    expect((io.engine as unknown as { opts: { perMessageDeflate: unknown } }).opts.perMessageDeflate).toBeTruthy();
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const unidos: { participanteId: string; clave: string }[] = [];
    for (let i = 0; i < 12; i++) unidos.push(await (await unirse(s.codigo)).json());
    gestor.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} });
    const mesa = (u: { participanteId: string }) => gestor.estado(s.id)!.participantes[u.participanteId].mesa;
    const a = socket({ tipo: 'jugador', sesionId: s.id, ...unidos.find((u) => mesa(u) === 1)! });
    const b = socket({ tipo: 'jugador', sesionId: s.id, ...unidos.find((u) => mesa(u) === 2)! });
    await Promise.all([primera(a, 'vista'), primera(b, 'vista')]);
    await new Promise((r) => setTimeout(r, 300));
    let deA = 0;
    let deB = 0;
    a.on('vista', () => { deA += 1; });
    b.on('vista', () => { deB += 1; });
    expect(await b.emitWithAck('comando', { opId: 'c1', tipo: 'leerCarta', datos: {} })).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 400));
    expect(deB).toBeGreaterThan(0);
    expect(deA).toBe(0);
  });

  it('consultar códigos que no existen también cuenta para el límite de intentos', async () => {
    for (let i = 0; i < 5; i++) expect((await fetch(`${base}/api/sesion?c=00000${i}`)).status).toBe(404);
    expect((await unirse('000000')).status).toBe(429);
  });

  it('al arrancar, la app retoma los simulados de las sesiones de prueba abiertas', async () => {
    const g = new GestorSesiones({ almacen: new Almacen(mkdtempSync(join(tmpdir(), 'tomatera-app-'))), contenidoBase: contenidoMinimo() });
    const s = g.crear({ prueba: true, velocidad: 60 });
    simular(g, s.id, 6, { semilla: 1 }); // este simulador se pierde, como en un reinicio
    g.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} });
    const otra = crearApp({ gestor: g, hostToken: 'h', adminToken: 'a', publicUrl: 'http://x', dirCliente: null });
    otra.tick();
    expect(Object.values(g.estado(s.id)!.participantes).every((p) => p.cartaLeida)).toBe(true);
    await otra.cerrar();
  });

  it('Leandro con clave incorrecta recibe connect_error «Clave incorrecta»', async () => {
    gestor.crear({ prueba: true, velocidad: 1 });
    const cliente = socket({ tipo: 'leandro', k: 'otra' });
    const error = await primera<Error>(cliente, 'connect_error');
    expect(error.message).toBe('Clave incorrecta');
  });

  it('Leandro con la clave correcta recibe la vista proyectada sin cartas', async () => {
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const cliente = socket({ tipo: 'leandro', k: 'clave-leandro', sesionId: s.id });
    const vista = await primera<{ tipo: string; enlace: string }>(cliente, 'vista');
    expect(vista.tipo).toBe('leandro');
    expect(vista.enlace).toBe(`http://203.0.113.24:8090/?c=${s.codigo}`);
    expect(JSON.stringify(vista)).not.toContain('Trae bomba');
  });

  it('seis fallos de unirse en un minuto devuelven 429', async () => {
    gestor.crear({ prueba: true, velocidad: 1 });
    for (let i = 0; i < 5; i++) expect((await unirse('000000')).status).toBe(400);
    const r = await unirse('000000');
    expect(r.status).toBe(429);
    expect((await r.json()).error).toBe('Demasiados intentos; espera un minuto');
  });

  it('tras varios códigos mal escritos desde la misma IP, quien tiene el código correcto entra igual', async () => {
    // En el aula todos los celulares salen a internet por la misma IP pública.
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    for (let i = 0; i < 6; i++) await unirse('000000');
    expect((await unirse('000000')).status).toBe(429);
    expect((await fetch(`${base}/api/sesion?c=${s.codigo}`)).status).toBe(200);
    expect((await unirse(s.codigo)).status).toBe(200);
  });

  it('los autores crean una sesión y la ven en la lista', async () => {
    const cliente = socket({ tipo: 'autores', k: 'clave-autores' });
    await primera(cliente, 'connect');
    const r = await cliente.emitWithAck('crearSesion', { prueba: true, velocidad: 10 });
    expect(r.ok).toBe(true);
    const lista = await cliente.emitWithAck('listarSesiones', {});
    expect(lista.map((x: { id: string }) => x.id)).toContain(r.sesionId);
  });

  it('el contenido para imprimir exige la clave de autores y trae las cartas y el enlace de la sesión', async () => {
    const s = gestor.crear({ prueba: false, velocidad: 1 });
    expect((await fetch(`${base}/api/autores/contenido?s=${s.id}&k=clave-leandro`)).status).toBe(403);
    const r = await fetch(`${base}/api/autores/contenido?s=${s.id}&k=clave-autores`);
    expect(r.status).toBe(200);
    const x = await r.json();
    expect(x.contenido.cartas.PO.quienEres).toBeTruthy();
    expect(x.sesion).toEqual({ codigo: s.codigo, enlace: `http://203.0.113.24:8090/?c=${s.codigo}` });
    const sinSesion = await (await fetch(`${base}/api/autores/contenido?k=clave-autores`)).json();
    expect(sinSesion.contenido.cartas.PO.quienEres).toBe(x.contenido.cartas.PO.quienEres);
  });

  it('la vista de los autores trae el registro y el enlace de Leandro para enviárselo', async () => {
    const s = gestor.crear({ prueba: false, velocidad: 1 });
    const cliente = socket({ tipo: 'autores', k: 'clave-autores', sesionId: s.id });
    const vista = await primera<{ tipo: string; enlaceLeandro: string; registro: unknown[] }>(cliente, 'vista');
    expect(vista.tipo).toBe('autores');
    expect(vista.enlaceLeandro).toBe('http://203.0.113.24:8090/leandro?k=clave-leandro');
    expect(vista.registro.length).toBeGreaterThan(0);
  });

  it('los autores simulan participantes solo en sesiones de prueba, y tick() los hace actuar', async () => {
    const prueba = gestor.crear({ prueba: true, velocidad: 60 });
    const real = gestor.crear({ prueba: false, velocidad: 1 });
    const cliente = socket({ tipo: 'autores', k: 'clave-autores' });
    expect(await cliente.emitWithAck('simular', { sesionId: prueba.id, n: 0 })).toEqual({ ok: false, error: 'Elige entre 1 y 45 participantes' });
    expect(await cliente.emitWithAck('simular', { sesionId: real.id, n: 6 })).toEqual({ ok: false, error: 'Solo se puede simular en una sesión de prueba' });
    expect(await cliente.emitWithAck('simular', { sesionId: prueba.id, n: 6 })).toEqual({ ok: true });
    expect(gestor.ejecutar(prueba.id, { tipo: 'leandro' }, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} })).toEqual({ ok: true });
    tick();
    const personas = Object.values(gestor.estado(prueba.id)!.participantes);
    expect(personas).toHaveLength(6);
    expect(personas.every((p) => p.bot && p.cartaLeida)).toBe(true);
  });
});

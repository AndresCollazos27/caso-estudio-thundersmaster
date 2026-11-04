import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Almacen } from '../../src/server/almacen.js';
import { crearApp } from '../../src/server/app.js';
import { exportarSesion, nombreExportacion } from '../../src/server/exportar.js';
import { GestorSesiones } from '../../src/server/gestor.js';
import { vistaJugador } from '../../src/shared/vistas.js';
import { contenidoMinimo } from '../fixtures/contenido.js';

function sesionConGente() {
  const gestor = new GestorSesiones({ almacen: new Almacen(mkdtempSync(join(tmpdir(), 'tomatera-exp-'))), contenidoBase: contenidoMinimo() });
  const s = gestor.crear({ prueba: true, velocidad: 1 });
  for (let i = 1; i <= 6; i++) gestor.unirse(s.codigo, `Apodo-${i}`, true);
  gestor.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} });
  gestor.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'l2', tipo: 'avanzarTramo', datos: {} });
  return { gestor, s };
}

describe('exportación', () => {
  it('la exportación no contiene la clave apodo en ningún nivel', () => {
    const { gestor, s } = sesionConGente();
    const x = exportarSesion(gestor.estado(s.id)!, gestor.eventos(s.id));
    const texto = JSON.stringify(x);
    expect(texto).not.toContain('"apodo"');
    expect(texto).not.toContain('Apodo-');
    expect(x.participantes).toHaveLength(6);
    expect(x.participantes[0]).toEqual({ id: expect.any(String), mesa: 1, roles: expect.any(Array), bot: false, espectador: false });
  });

  it('ni la exportación ni la vista de un compañero contienen la clave secreta de nadie', () => {
    const gestor = new GestorSesiones({ almacen: new Almacen(mkdtempSync(join(tmpdir(), 'tomatera-exp-'))), contenidoBase: contenidoMinimo() });
    const s = gestor.crear({ prueba: true, velocidad: 1 });
    const unidos = Array.from({ length: 6 }, () => gestor.unirse(s.codigo, undefined, true) as { participanteId: string; clave: string });
    gestor.ejecutar(s.id, { tipo: 'leandro' }, { opId: 'l1', tipo: 'cerrarInscripcion', datos: {} });
    const claves = unidos.map((u) => u.clave);
    expect(claves.every((c) => typeof c === 'string' && c.length >= 20)).toBe(true);
    const textos = [
      JSON.stringify(exportarSesion(gestor.estado(s.id)!, gestor.eventos(s.id))),
      JSON.stringify(vistaJugador(gestor.estado(s.id)!, unidos[0].participanteId, 0)),
    ];
    for (const t of textos) for (const c of claves) expect(t).not.toContain(c);
  });

  it('incluye todos los eventos y las lecturas de cada mesa', () => {
    const { gestor, s } = sesionConGente();
    const x = exportarSesion(gestor.estado(s.id)!, gestor.eventos(s.id));
    expect(x.eventos.map((e) => e.seq)).toEqual(gestor.eventos(s.id).map((e) => e.seq));
    expect(x.mesas).toHaveLength(1);
    expect(x.mesas[0].numero).toBe(1);
    expect(x.mesas[0].lecturas.E1.valor).toBeDefined();
    expect(x.sesion).toMatchObject({ id: s.id, codigo: s.codigo, prueba: true, creadaEn: s.creadaEn });
    expect(x.sesion.contenidoVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(x.contenido.caso.nombre).toBe(gestor.estado(s.id)!.contenido.caso.nombre);
  });

  it('el archivo se llama tomatera-<código>-<AAAAMMDD-HHmm>.json', () => {
    expect(nombreExportacion('123456', new Date(2026, 10, 2, 9, 5))).toBe('tomatera-123456-20261102-0905.json');
  });

  it('la ruta exige la clave de autores', async () => {
    const { gestor, s } = sesionConGente();
    const app = crearApp({ gestor, hostToken: 'clave-leandro', adminToken: 'clave-autores', publicUrl: 'http://203.0.113.24:8090', dirCliente: null });
    await new Promise<void>((r) => app.http.listen(0, '127.0.0.1', () => r()));
    const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}/api/autores/exportar?s=${s.id}`;
    try {
      expect((await fetch(`${base}&k=clave-leandro`)).status).toBe(403);
      expect((await fetch(base)).status).toBe(403);
      const r = await fetch(`${base}&k=clave-autores`);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-disposition')).toMatch(new RegExp(`^attachment; filename="tomatera-${s.codigo}-\\d{8}-\\d{4}\\.json"$`));
      expect((await r.json()).sesion.id).toBe(s.id);
    } finally {
      await app.cerrar();
    }
  });
});

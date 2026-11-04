import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Evento } from '../../src/shared/eventos.js';
import { Almacen } from '../../src/server/almacen.js';

const evento = (seq: number): Evento =>
  ({ seq, en: 1000 + seq, tipo: 'hito.hecho', por: { tipo: 'sistema' }, datos: { id: `h${seq}` } }) as Evento;

describe('Almacen', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tomatera-')); });

  it('agrega y relee en orden', () => {
    const a = new Almacen(dir);
    for (let i = 1; i <= 3; i++) a.agregar('s1', evento(i));
    expect(a.leer('s1').map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('otro Almacen sobre el mismo directorio ve las mismas sesiones', () => {
    const a = new Almacen(dir);
    a.agregar('s1', evento(1));
    a.agregar('s2', evento(1));
    const b = new Almacen(dir);
    expect(b.sesiones().sort()).toEqual(['s1', 's2']);
    expect(b.leer('s2')).toHaveLength(1);
  });

  it('una última línea a medias se ignora y se avisa por consola', () => {
    const a = new Almacen(dir);
    a.agregar('s1', evento(1));
    appendFileSync(join(dir, 's1', 'eventos.jsonl'), '{"seq":2,"en":10');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(new Almacen(dir).leer('s1').map((e) => e.seq)).toEqual([1]);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('después de una caída con una línea a medias, el evento siguiente no se pierde', () => {
    const a = new Almacen(dir);
    a.agregar('s1', evento(1));
    a.cerrar();
    appendFileSync(join(dir, 's1', 'eventos.jsonl'), '{"seq":2,"en":10');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reiniciado = new Almacen(dir);
    reiniciado.agregar('s1', evento(2));
    reiniciado.cerrar();
    expect(new Almacen(dir).leer('s1').map((e) => e.seq)).toEqual([1, 2]);
    aviso.mockRestore();
  });

  it('los eventos de un comando se guardan juntos', () => {
    const a = new Almacen(dir);
    a.agregarVarios('s1', [evento(1), evento(2), evento(3)]);
    expect(a.leer('s1').map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('ningún evento guardado contiene una IP', () => {
    const a = new Almacen(dir);
    a.agregar('s1', evento(1));
    const crudo = readFileSync(join(dir, 's1', 'eventos.jsonl'), 'utf8');
    expect(crudo).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });

  it('rechaza un id de sesión que podría salir de la carpeta de datos', () => {
    const a = new Almacen(dir);
    expect(() => a.agregar('../fuera', evento(1))).toThrow('Identificador de sesión inválido');
  });
});

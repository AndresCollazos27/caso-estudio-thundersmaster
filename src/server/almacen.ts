import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, truncateSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { Evento } from '../shared/eventos.js';

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const ARCHIVO = 'eventos.jsonl';

// Una línea JSON por evento, forzada a disco antes de seguir: si el servidor se cae, no se pierde nada escrito.
export class Almacen {
  private descriptores = new Map<string, number>();

  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private ruta(sesionId: string): string {
    if (!ID_VALIDO.test(sesionId)) throw new Error('Identificador de sesión inválido');
    return join(this.dir, sesionId);
  }

  sesiones(): string[] {
    return readdirSync(this.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && ID_VALIDO.test(d.name) && existsSync(join(this.dir, d.name, ARCHIVO)))
      .map((d) => d.name);
  }

  leer(sesionId: string): Evento[] {
    const archivo = join(this.ruta(sesionId), ARCHIVO);
    if (!existsSync(archivo)) return [];
    const lineas = readFileSync(archivo, 'utf8').split('\n').filter((l) => l.trim() !== '');
    const eventos: Evento[] = [];
    lineas.forEach((linea, i) => {
      try {
        eventos.push(JSON.parse(linea) as Evento);
      } catch {
        console.warn(`[tomatera] ${sesionId}: se ignora la línea ${i + 1} de ${ARCHIVO}, que quedó incompleta`);
      }
    });
    return eventos;
  }

  // Si una caída dejó la última línea a medias, se corta antes de volver a escribir: si no, el evento
  // siguiente quedaría pegado a ella y se perdería en la próxima lectura.
  private abrir(sesionId: string): number {
    const abierto = this.descriptores.get(sesionId);
    if (abierto !== undefined) return abierto;
    const carpeta = this.ruta(sesionId);
    mkdirSync(carpeta, { recursive: true });
    const archivo = join(carpeta, ARCHIVO);
    if (existsSync(archivo)) {
      const bytes = readFileSync(archivo);
      if (bytes.length > 0 && bytes[bytes.length - 1] !== 0x0a) {
        console.warn(`[tomatera] ${sesionId}: se descarta la última línea de ${ARCHIVO}, que quedó incompleta`);
        truncateSync(archivo, bytes.lastIndexOf(0x0a) + 1);
      }
    }
    const fd = openSync(archivo, 'a');
    this.descriptores.set(sesionId, fd);
    return fd;
  }

  agregar(sesionId: string, e: Evento): void {
    this.agregarVarios(sesionId, [e]);
  }

  // Los eventos de un mismo comando van en una sola escritura y un solo fsync.
  agregarVarios(sesionId: string, eventos: Evento[]): void {
    if (eventos.length === 0) return;
    const fd = this.abrir(sesionId);
    writeSync(fd, eventos.map((e) => `${JSON.stringify(e)}\n`).join(''));
    fsyncSync(fd);
  }

  cerrar(): void {
    for (const fd of this.descriptores.values()) closeSync(fd);
    this.descriptores.clear();
  }
}

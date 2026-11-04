import { readFileSync } from 'node:fs';
import { cargarContenido, type Contenido } from '../../src/shared/contenido.js';

export function contenidoMinimo(): Contenido {
  return cargarContenido(readFileSync(new URL('./contenido-minimo.yaml', import.meta.url), 'utf8'));
}

export function contenidoReal(): Contenido {
  return cargarContenido(readFileSync(new URL('../../content/caso-tomatera.yaml', import.meta.url), 'utf8'));
}

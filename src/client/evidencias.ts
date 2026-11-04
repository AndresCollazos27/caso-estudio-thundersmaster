import type { Lectura } from '../shared/lecturas.js';
import type { SiNoPend } from '../shared/valores.js';

// El FR marcó «Sí» en una evidencia que la lectura automática no respalda: su casilla se pinta de naranja.
export const sinRespaldo = (lectura: Lectura, resultado?: SiNoPend): boolean => resultado === 'Sí' && lectura.valor !== 'Sí';

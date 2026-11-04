import { sinRespaldo } from '../../src/client/evidencias.js';

describe('evidencias', () => {
  it('sinRespaldo da true si el FR marca «Sí» y la lectura no es «Sí»', () => {
    expect(sinRespaldo({ valor: 'No', texto: 'x' }, 'Sí')).toBe(true);
    expect(sinRespaldo({ valor: 'Pendiente', texto: 'x' }, 'Sí')).toBe(true);
    expect(sinRespaldo({ valor: 'Sí', texto: 'x' }, 'Sí')).toBe(false);
    expect(sinRespaldo({ valor: 'No', texto: 'x' }, 'No')).toBe(false);
    expect(sinRespaldo({ valor: 'No', texto: 'x' }, undefined)).toBe(false);
  });
});

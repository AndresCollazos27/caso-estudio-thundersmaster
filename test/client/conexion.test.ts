import { calcularDesfase, nuevoOpId } from '../../src/client/conexion.js';

describe('conexión del cliente', () => {
  it('nuevoOpId no usa randomUUID y da 1000 valores distintos', () => {
    // Por http, sin contexto seguro, el navegador no ofrece randomUUID.
    const espia = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('randomUUID no está disponible por http');
    });
    try {
      const ids = new Set(Array.from({ length: 1000 }, () => nuevoOpId()));
      expect(ids.size).toBe(1000);
      expect(espia).not.toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
  });

  it('calcularDesfase(1000, 400) da 600', () => {
    expect(calcularDesfase(1000, 400)).toBe(600);
  });
});

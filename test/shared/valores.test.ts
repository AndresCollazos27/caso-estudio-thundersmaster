import {
  SI_NO, SI_NO_PEND, IMPLICITO, COSTO, ROLES_MAPA, ESTADO_TERMINO, PRIORIDAD, ESTADO_NECESIDAD,
  TIPO_REQUISITO, CONFORMIDAD, DETECTADA_EN, ESTADO_DIVERGENCIA, REVISION_I2A, TECNICA_I3,
  RESULTADO_I3, ROLES, TRAMOS, MAX_TEXTO,
} from '../../src/shared/valores.js';

describe('valores de lista', () => {
  it('las listas copian el libro de la versión final', () => {
    expect(ESTADO_TERMINO).toEqual(['Tentativo', 'Acordado', 'Acordado y comprobado', 'En divergencia']);
    expect(ESTADO_NECESIDAD).toEqual(['Nueva', 'Duplicada', 'En conflicto', 'Fuera de alcance']);
    expect(DETECTADA_EN).toEqual(['A4 apertura', 'I3 paráfrasis cruzada', 'I3 sondeo de ambigüedad', 'I3 ejemplo concreto', 'I3 sistema de referencia', 'I2 aceptación', 'Prueba de traspaso', 'Paquete de cierre', 'Otra']);
    expect(ESTADO_DIVERGENCIA).toEqual(['Resuelta y confirmada', 'Pendiente', 'No crítica: cierra por objeción']);
    expect(TECNICA_I3).toEqual(['Paráfrasis cruzada', 'Sondeo de ambigüedad', 'Ejemplo concreto', 'Sistema de referencia']);
    expect(RESULTADO_I3).toEqual(['Alineado', 'Divergencia', 'Pendiente']);
    expect(REVISION_I2A).toEqual(['Cumple', 'Corregir', 'Pendiente']);
    expect(ROLES).toEqual(['PO', 'SD', 'SD2', 'FR', 'AN', 'QA', 'RT']);
    expect(TRAMOS).toEqual(['explicacion', 'lectura', 'medicion_previa', 'a4', 'a51', 'a52', 'a53', 'a6', 'medicion_posterior', 'destape']);
    expect(MAX_TEXTO).toBe(600);
  });

  it('las listas cortas también copian el libro', () => {
    expect(SI_NO).toEqual(['Sí', 'No']);
    expect(SI_NO_PEND).toEqual(['Sí', 'No', 'Pendiente']);
    expect(IMPLICITO).toEqual(['Alto', 'Bajo']);
    expect(COSTO).toEqual(['Barato', 'Caro']);
    expect(ROLES_MAPA).toEqual(['FR', 'AN', 'RT', 'SD', 'PO', 'QA', 'Otro', 'No convocado', 'Fuente no humana']);
    expect(PRIORIDAD).toEqual(['Alta', 'Media', 'Baja']);
    expect(TIPO_REQUISITO).toEqual(['Funcional', 'Calidad', 'Restricción']);
    expect(CONFORMIDAD).toEqual(['Firma', 'Verbal', 'Acta']);
  });
});

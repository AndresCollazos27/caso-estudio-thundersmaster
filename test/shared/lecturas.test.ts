import {
  contadorI3, divergenciasSinRegistrar, esCritica, estadoCiclo, leerB3, leerE1, leerE2, leerE3, leerE4, leerE5,
  muestraTraspaso, resultadoFilaI2C,
} from '../../src/shared/lecturas.js';
import type { Mesa } from '../../src/shared/tipos.js';
import { divergencia, mesaVacia, tarjeta, termino } from '../fixtures/mesa.js';

const con = (cambiar: (m: Mesa) => void): Mesa => { const m = mesaVacia(); cambiar(m); return m; };

describe('E1', () => {
  it('pendiente sin marcas', () => {
    expect(leerE1(mesaVacia())).toEqual({ valor: 'Pendiente', texto: 'Pendiente: faltan reformulaciones de los perfiles críticos' });
  });
  it('no con una versión no equivalente', () => {
    const m = con((m) => { m.apertura.equivalencia = { SD: 'Sí', AN: 'No', PO: 'Sí' }; });
    expect(leerE1(m)).toEqual({ valor: 'No', texto: 'No: hay versiones no equivalentes (registre la divergencia en 06)' });
  });
  it('sí con las tres equivalentes', () => {
    const m = con((m) => { m.apertura.equivalencia = { SD: 'Sí', AN: 'Sí', PO: 'Sí' }; });
    expect(leerE1(m)).toEqual({ valor: 'Sí', texto: 'Sí: las versiones de los perfiles críticos son equivalentes' });
  });
});

describe('E2', () => {
  it('pendiente sin términos críticos', () => {
    const m = con((m) => { m.glosario = [termino('T-01', { critico: 'No' })]; });
    expect(leerE2(m).texto).toBe('Pendiente: no hay términos críticos marcados');
  });
  it('no con un crítico tentativo', () => {
    const m = con((m) => { m.glosario = [termino('T-01', { estado: 'Acordado' }), termino('T-02', { estado: 'Tentativo' })]; });
    expect(leerE2(m)).toEqual({ valor: 'No', texto: 'No: 1 término(s) crítico(s) sin definición acordada (registre la divergencia en 06)' });
  });
  it('pendiente si ningún crítico está comprobado', () => {
    const m = con((m) => { m.glosario = [termino('T-01', { estado: 'Acordado' }), termino('T-02', { estado: 'Acordado' })]; });
    expect(leerE2(m).texto).toBe('Pendiente: ningún término crítico se comprobó entre perfiles distintos');
  });
  it('sí con críticos acordados y alguno comprobado', () => {
    const m = con((m) => { m.glosario = [termino('T-01', { estado: 'Acordado y comprobado' }), termino('T-02', { estado: 'Acordado' })]; });
    expect(leerE2(m)).toEqual({ valor: 'Sí', texto: 'Sí: 2 término(s) crítico(s) acordados; 1 comprobados entre perfiles' });
  });
});

describe('I2-C y E3', () => {
  it('resultadoFilaI2C sigue la fórmula del libro', () => {
    expect(resultadoFilaI2C({ C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: 'x' })).toBe('Aceptado');
    expect(resultadoFilaI2C({ C1: 'Sí', C2: 'Sí', C3: 'No', esperado: 'x' })).toBe('Divergencia → 06');
    expect(resultadoFilaI2C({ esperado: '' })).toBe('Por validar');
    expect(resultadoFilaI2C({ C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: '' })).toBe('Pendiente');
    expect(resultadoFilaI2C({ C1: 'Sí', esperado: '' })).toBe('Pendiente');
  });
  it('E3 pendiente sin críticas', () => {
    expect(leerE3(mesaVacia()).texto).toBe('Pendiente: no hay requisitos críticos marcados en 05');
  });
  it('E3 no con una crítica en divergencia', () => {
    const m = con((m) => {
      m.tarjetas = [tarjeta('R-01'), tarjeta('R-02')];
      m.i2c = { 'R-01': { C1: 'Sí', C2: 'No', C3: 'Sí', esperado: 'x' }, 'R-02': { C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: 'x' } };
    });
    expect(leerE3(m)).toEqual({ valor: 'No', texto: 'No: 1 crítico(s) con divergencia (ver 06)' });
  });
  it('E3 sí con las críticas aceptadas', () => {
    const m = con((m) => {
      m.tarjetas = [tarjeta('R-01'), tarjeta('R-02'), tarjeta('R-03', { critico: 'No' })];
      m.i2c = { 'R-01': { C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: 'x' }, 'R-02': { C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: 'y' } };
    });
    expect(leerE3(m)).toEqual({ valor: 'Sí', texto: 'Sí: los 2 críticos tienen ejemplo y criterio aceptados' });
  });
  it('E3 usa el resultado esperado que el cliente escribió por necesidad', () => {
    const m = con((m) => {
      m.tarjetas = [tarjeta('R-01', { necesidadId: 'N-04' })];
      m.esperadosPorNecesidad = { 'N-04': 'Que me avise a tiempo' };
      m.i2c = { 'R-01': { C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: '' } };
    });
    expect(leerE3(m).valor).toBe('Sí');
  });
  it('E3 pendiente con una de dos aceptada', () => {
    const m = con((m) => {
      m.tarjetas = [tarjeta('R-01'), tarjeta('R-02')];
      m.i2c = { 'R-01': { C1: 'Sí', C2: 'Sí', C3: 'Sí', esperado: 'x' } };
    });
    expect(leerE3(m).texto).toBe('Pendiente: 1 de 2 críticos aceptados');
  });
});

describe('E4', () => {
  it('sí sin divergencias', () => {
    expect(leerE4(mesaVacia())).toEqual({ valor: 'Sí', texto: 'Sí: no se registraron divergencias en el ciclo' });
  });
  it('pendiente con una crítica sin resolver', () => {
    const m = con((m) => { m.divergencias = [divergencia('D-01')]; });
    expect(leerE4(m).texto).toBe('Pendiente: 1 divergencia(s) crítica(s) sin resolver y confirmar');
  });
  it('pendiente con un resultado de ronda sin registrar', () => {
    const m = con((m) => {
      m.rondas = [{ numero: 1, lanzadaEn: 0, items: [], respuestas: {}, resultados: { guia: { resultado: 'Pendiente', marcadoPor: 'p1' } } }];
    });
    expect(divergenciasSinRegistrar(m)).toBe(1);
    expect(leerE4(m).texto).toBe('Pendiente: 1 divergencia(s) detectada(s) en I3 o I2 sin registrar aquí');
  });
  it('sí con divergencias registradas y las críticas resueltas', () => {
    const m = con((m) => {
      m.tarjetas = [tarjeta('R-01', { critico: 'No' })];
      m.divergencias = [divergencia('D-01', { estado: 'Resuelta y confirmada' }), divergencia('D-02', { afectaA: 'R-01', estado: 'Pendiente' })];
    });
    expect(leerE4(m)).toEqual({ valor: 'Sí', texto: 'Sí: 2 divergencia(s) registradas; las críticas están resueltas y confirmadas' });
  });
  it('esCritica mira la tarjeta o el término afectado', () => {
    const m = con((m) => { m.tarjetas = [tarjeta('R-01', { critico: 'No' })]; m.glosario = [termino('T-01')]; });
    expect(esCritica(divergencia('D-1', { afectaA: 'R-01' }), m)).toBe(false);
    expect(esCritica(divergencia('D-2', { afectaA: 'T-01' }), m)).toBe(true);
    expect(esCritica(divergencia('D-3', { afectaA: '' }), m)).toBe(true);
  });
});

describe('E5, ciclo, B3 e I3', () => {
  it('muestraTraspaso es dos o el 20 % de las críticas', () => {
    expect([0, 1, 2, 3, 10, 11, 25].map(muestraTraspaso)).toEqual([0, 1, 2, 2, 2, 3, 5]);
  });
  it('E5 pendiente sin críticas en la línea base', () => {
    expect(leerE5(mesaVacia())).toEqual({ valor: 'Pendiente', texto: 'Pendiente: no hay críticos en la línea base' });
  });
  it('E5 según las reconstrucciones', () => {
    const base = (items: Mesa['traspaso']['items']) => con((m) => {
      m.lineaBase.instantanea = { tarjetas: [tarjeta('R-01'), tarjeta('R-02')], glosario: [] };
      m.traspaso.items = items;
    });
    const r = (coincide?: 'Sí' | 'No') => ({ reconstruccion: 'x', coincide, correccion: '' });
    expect(leerE5(base({ 'R-01': r('Sí'), 'R-02': r('Sí') })).texto).toBe('Sí: 2 de 2 reconstrucciones coinciden');
    expect(leerE5(base({ 'R-01': r('Sí'), 'R-02': r('No') })).texto).toBe('No: una reconstrucción no coincide; corrija la tarjeta o el paquete y repita');
    expect(leerE5(base({ 'R-01': r('Sí') })).texto).toBe('Pendiente: 1 de 2 reconstrucciones confirmadas');
  });
  it('estadoCiclo usa lo que marcó el FR', () => {
    const todas = con((m) => {
      m.lineaBase.evidencias = { E1: { resultado: 'Sí', nota: '' }, E2: { resultado: 'Sí', nota: '' }, E3: { resultado: 'Sí', nota: '' }, E4: { resultado: 'Sí', nota: '' }, E5: { resultado: 'Sí', nota: '' } };
    });
    expect(estadoCiclo(todas)).toBe('CERRADO: las cinco evidencias están en «Sí»');
    const tres = con((m) => {
      m.lineaBase.evidencias = { E1: { resultado: 'Sí', nota: '' }, E2: { resultado: 'No', nota: '' }, E3: { resultado: 'Sí', nota: '' }, E4: { resultado: 'Sí', nota: '' } };
    });
    expect(estadoCiclo(tres)).toBe('ABIERTO: 2 evidencia(s) sin «Sí». Un «No» abre una divergencia (06); un «Pendiente», una acción con responsable y fecha');
  });
  it('B3 cuenta las necesidades priorizadas sin tarjeta', () => {
    expect(leerB3(mesaVacia()).texto).toBe('Pendiente: no hay necesidades en 04');
    const nec = (id: string, estado: 'Nueva' | 'Duplicada' = 'Nueva') => ({
      id, bloque: 1, necesidad: 'n', fuente: 'Paco', contextoValor: '', supuestos: '', prioridad: 'Alta' as const, estado, editadoPor: '',
    });
    const sin = con((m) => { m.necesidades = [nec('N-01'), nec('N-02', 'Duplicada')]; });
    expect(leerB3(sin)).toEqual({ valor: 'No', texto: 'No: 1 necesidad(es) priorizada(s) sin requisito (ver 04)' });
    const cubierta = con((m) => { m.necesidades = [nec('N-01')]; m.tarjetas = [tarjeta('R-01', { necesidadId: 'N-01' })]; });
    expect(leerB3(cubierta).texto).toBe('Sí: toda necesidad priorizada tiene requisito');
  });
  it('contadorI3 compara planificados y hechos', () => {
    const item = (id: string) => ({ id, termino: id, tecnica: 'Paráfrasis cruzada' as const, pregunta: '?' });
    const m = con((m) => {
      m.planI3 = [{ numero: 1, items: [item('a'), item('b')] }, { numero: 2, items: [item('c'), item('d')] }];
      const hecho = { resultado: 'Alineado' as const, marcadoPor: 'p1' };
      m.rondas = [
        { numero: 1, lanzadaEn: 0, items: [item('a'), item('b')], respuestas: {}, resultados: { a: hecho, b: hecho } },
        { numero: 2, lanzadaEn: 0, items: [item('c'), item('d')], respuestas: {}, resultados: { c: hecho, d: hecho } },
      ];
    });
    expect(contadorI3(m)).toBe('Puntos críticos planificados: 4 · micro-chequeos hechos: 4 · mínimo: 4 → Cumple');
    m.rondas[1].resultados = {};
    expect(contadorI3(m)).toBe('Puntos críticos planificados: 4 · micro-chequeos hechos: 2 · mínimo: 4 → faltan 2');
  });
});

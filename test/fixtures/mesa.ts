import type { Divergencia, Mesa, Tarjeta, Termino } from '../../src/shared/tipos.js';

export function mesaVacia(numero = 1): Mesa {
  return {
    numero,
    miembros: {},
    apertura: { versiones: {}, equivalencia: {}, ajustes: '' },
    glosario: [],
    necesidades: [],
    tarjetas: [],
    i2a: {},
    i2b: { obsB1: '', obsB2: '' },
    i2c: {},
    esperadosPorNecesidad: {},
    planI3: [],
    rondas: [],
    chequeosBloque: { obs: '' },
    validacion06: { conjunto: '', fechaParticipantes: '', tecnica: '', constancia: '' },
    divergencias: [],
    lineaBase: { evidencias: {} },
    traspaso: { items: {} },
    acciones: [],
    destape: {},
    fichaPedidas: [],
    reabiertos: [],
  };
}

export function termino(id: string, cambios: Partial<Termino> = {}): Termino {
  return { id, termino: id, definicion: 'd', ejemplo: '', critico: 'Sí', estado: 'Tentativo', responsable: '', editadoPor: '', ...cambios };
}

export function tarjeta(id: string, cambios: Partial<Tarjeta> = {}): Tarjeta {
  return {
    id, necesidadId: 'N-01', tipo: 'Funcional', enunciado: `Requisito ${id}`, critico: 'Sí', criterioEjemplo: 'Ejemplo',
    restriccion: '', acepta: '', editadoPor: '', ...cambios,
  };
}

export function divergencia(id: string, cambios: Partial<Divergencia> = {}): Divergencia {
  return {
    id, detectadaEn: 'Otra', afectaA: '', descripcion: 'Dos lecturas', resolucion: '', estado: 'Pendiente', responsable: '',
    fechaLimite: '', creadaPor: '', ...cambios,
  };
}

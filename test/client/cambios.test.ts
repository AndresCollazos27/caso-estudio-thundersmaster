import { aplicarCambio, guardarCambios, leerCambios } from '../../src/client/cambios.js';
import { Escenario } from '../fixtures/escenario.js';

describe('formularios que envían solo lo que cambió', () => {
  it('aplicarCambio guarda el campo que cambió y lo quita si vuelve a su valor original', () => {
    const base = { enunciado: 'Aviso', criterioEjemplo: '' };
    const c = aplicarCambio({}, base, 'criterioEjemplo', '29 % avisa');
    expect(c).toEqual({ criterioEjemplo: '29 % avisa' });
    expect(aplicarCambio(c, base, 'criterioEjemplo', '')).toEqual({});
  });

  it('un borrador mal formado o del formato anterior no se toma como cambios', () => {
    expect(leerCambios('no es json')).toEqual({});
    expect(leerCambios('{"enunciado":"todo el formulario viejo"}')).toEqual({});
    expect(leerCambios(guardarCambios({ enunciado: 'x' }))).toEqual({ enunciado: 'x' });
  });

  it('dos personas editan a la vez la misma tarjeta y ninguna borra lo de la otra', () => {
    const e = new Escenario();
    e.irA('a51');
    e.ok(e.quien('AN'), 'guardarNecesidad', { necesidad: 'Saber cuándo regar', fuente: 'Paco Ruiz, asesor de huerto', prioridad: 'Alta' });
    e.irA('a52');
    e.ok(e.quien('AN'), 'guardarTarjeta', { necesidadId: 'N-01', enunciado: 'Aviso de riego', critico: 'Sí' });
    const t = e.estado.mesas[1].tarjetas[0];
    // Los dos abren el formulario con lo mismo; el QA agrega el criterio y el AN corrige el enunciado.
    const base = { enunciado: t.enunciado, criterioEjemplo: t.criterioEjemplo, tipo: t.tipo, critico: t.critico };
    const delQA = aplicarCambio({}, base, 'criterioEjemplo', '29 % avisa; 30 % no');
    const delAN = aplicarCambio({}, base, 'enunciado', 'Aviso cuando la tierra está seca');
    e.ok(e.quien('QA'), 'guardarTarjeta', { id: t.id, ...delQA });
    e.ok(e.quien('AN'), 'guardarTarjeta', { id: t.id, ...delAN });
    expect(e.estado.mesas[1].tarjetas[0]).toMatchObject({ enunciado: 'Aviso cuando la tierra está seca', criterioEjemplo: '29 % avisa; 30 % no' });
  });
});

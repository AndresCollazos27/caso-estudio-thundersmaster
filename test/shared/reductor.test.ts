import type { Evento } from '../../src/shared/eventos.js';
import { idAzar, siguienteId } from '../../src/shared/ids.js';
import { aplicarEvento, reconstruir } from '../../src/shared/reductor.js';
import type { EstadoDeSesion } from '../../src/shared/tipos.js';
import { contenidoMinimo } from '../fixtures/contenido.js';

const sistema = { tipo: 'sistema' } as const;
let seq = 0;
const ev = (e: Omit<Evento, 'seq' | 'en' | 'por'> & Partial<Pick<Evento, 'en' | 'por'>>): Evento =>
  ({ seq: ++seq, en: 1000 + seq, por: sistema, ...e }) as Evento;

function sesionConMesa(): EstadoDeSesion {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  return reconstruir([
    ev({ tipo: 'sesion.creada', datos: { id: 's1', codigo: '123456', prueba: true, velocidad: 1, contenido: contenidoMinimo() } }),
    ...ids.map((id) => ev({ tipo: 'participante.unido', datos: { id, bot: false } })),
    ev({
      tipo: 'inscripcion.cerrada',
      datos: {
        mesas: [{ numero: 1, miembros: { p1: ['PO'], p2: ['SD'], p3: ['FR'], p4: ['AN'], p5: ['QA'], p6: ['RT'] } }],
        espectadores: [],
      },
    }),
  ]);
}

function congelarProfundo<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) congelarProfundo(v);
  }
  return o;
}

describe('reductor', () => {
  it('sesion.creada deja el estado en inscripción con la copia del contenido', () => {
    const c = contenidoMinimo();
    const e = reconstruir([ev({ tipo: 'sesion.creada', datos: { id: 's1', codigo: '123456', prueba: false, velocidad: 1, contenido: c } })]);
    expect(e.estado).toBe('inscripcion');
    expect(e.codigo).toBe('123456');
    expect(e.contenido.caso.nombre).toBe('Tomatera');
    expect(e.tramoIndice).toBeNull();
    expect(e.avanceAutomatico).toBe(true);
  });

  it('inscripcion.cerrada crea las mesas con el glosario semilla en «Tentativo» y el plan de I3', () => {
    const e = sesionConMesa();
    const m = e.mesas[1];
    expect(m.glosario.map((t) => t.id)).toEqual(['T-01', 'T-02']);
    expect(m.glosario.every((t) => t.estado === 'Tentativo')).toBe(true);
    expect(m.planI3.map((r) => r.numero)).toEqual([1, 2]);
    expect(m.miembros.p3).toEqual(['FR']);
    expect(e.participantes.p3).toMatchObject({ mesa: 1, roles: ['FR'] });
  });

  it('tramo.iniciado con índice 0 pasa a en_curso', () => {
    const e = aplicarEvento(sesionConMesa(), ev({ tipo: 'tramo.iniciado', en: 5000, datos: { indice: 0 } }));
    expect(e.estado).toBe('en_curso');
    expect(e.tramoIndice).toBe(0);
    expect(e.tramoInicio).toBe(5000);
  });

  it('termino.guardado reemplaza por id y conserva el orden', () => {
    const base = sesionConMesa();
    const t = { ...base.mesas[1].glosario[0], definicion: 'El tallo principal' };
    const e = aplicarEvento(base, ev({ tipo: 'termino.guardado', mesa: 1, datos: { termino: t } }));
    expect(e.mesas[1].glosario.map((x) => x.id)).toEqual(['T-01', 'T-02']);
    expect(e.mesas[1].glosario[0].definicion).toBe('El tallo principal');
  });

  it('ronda.lanzada agrega la ronda a todas las mesas con los ítems del plan', () => {
    const e = aplicarEvento(sesionConMesa(), ev({ tipo: 'ronda.lanzada', en: 9000, datos: { numero: 1 } }));
    expect(e.mesas[1].rondas).toHaveLength(1);
    expect(e.mesas[1].rondas[0]).toMatchObject({ numero: 1, lanzadaEn: 9000 });
    expect(e.mesas[1].rondas[0].items.map((i) => i.id)).toEqual(['guia']);
  });

  it('conexion solo cambia participante.conectado', () => {
    const base = sesionConMesa();
    const e = aplicarEvento(base, ev({ tipo: 'conexion', datos: { participante: 'p2', conectado: false } }));
    expect(e.participantes.p2.conectado).toBe(false);
    expect({ ...e.participantes.p2, conectado: true }).toEqual(base.participantes.p2);
    expect(e.mesas).toEqual(base.mesas);
  });

  it('aplicarEvento no muta el estado recibido', () => {
    const base = congelarProfundo(sesionConMesa());
    expect(() => aplicarEvento(base, ev({ tipo: 'ronda.lanzada', datos: { numero: 1 } }))).not.toThrow();
    expect(() => aplicarEvento(base, ev({ tipo: 'apertura.marca', mesa: 1, datos: { perfil: 'PO', valor: 'No' } }))).not.toThrow();
    expect(base.mesas[1].rondas).toHaveLength(0);
  });
});

describe('ids', () => {
  it('siguienteId continúa la numeración', () => {
    expect(siguienteId('N', [{ id: 'N-01' }, { id: 'N-02' }])).toBe('N-03');
    expect(siguienteId('D', [])).toBe('D-01');
    expect(siguienteId('R', [{ id: 'R-09' }, { id: 'R-03' }])).toBe('R-10');
  });

  it('idAzar da 1000 valores distintos', () => {
    const vistos = new Set(Array.from({ length: 1000 }, () => idAzar()));
    expect(vistos.size).toBe(1000);
  });
});

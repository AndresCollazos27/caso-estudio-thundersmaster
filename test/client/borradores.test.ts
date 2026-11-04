import { crearBorradores } from '../../src/client/borradores.js';
import { crearIdentidad } from '../../src/client/identidad.js';

// Un almacenamiento que falla en todo, como Safari en modo privado o con los datos del sitio bloqueados.
const roto = {
  getItem: () => { throw new Error('bloqueado'); },
  setItem: () => { throw new Error('bloqueado'); },
  removeItem: () => { throw new Error('bloqueado'); },
} as unknown as Storage;

function memoria(): Storage {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  } as unknown as Storage;
}

describe('borradores', () => {
  it('los borradores funcionan con un storage que lanza error', () => {
    const b = crearBorradores(roto);
    expect(() => b.guardar('version', 'Que riegue sola')).not.toThrow();
    expect(b.leer('version')).toBe('');
    expect(() => b.borrar('version')).not.toThrow();
  });

  it('sin storage, leer devuelve vacío', () => {
    expect(crearBorradores(null).leer('x')).toBe('');
  });

  it('con un storage que sirve, guarda, lee y borra', () => {
    const b = crearBorradores(memoria());
    b.guardar('version', 'Que avise');
    expect(b.leer('version')).toBe('Que avise');
    b.borrar('version');
    expect(b.leer('version')).toBe('');
  });
});

describe('identidad', () => {
  it('guarda y lee la identidad, y con un storage roto devuelve null sin fallar', () => {
    const id = crearIdentidad(memoria());
    id.guardar({ sesionId: 's1', participanteId: 'p1', clave: 'secreta', codigo: '123456' });
    expect(id.leer()).toEqual({ sesionId: 's1', participanteId: 'p1', clave: 'secreta', codigo: '123456' });
    id.borrar();
    expect(id.leer()).toBeNull();
    const rota = crearIdentidad(roto);
    expect(() => rota.guardar({ sesionId: 's1', participanteId: 'p1', clave: 'x', codigo: '1' })).not.toThrow();
    expect(rota.leer()).toBeNull();
  });

  it('una identidad mal guardada se descarta', () => {
    const s = memoria();
    s.setItem('tomatera:identidad', '{"sesionId": 3');
    expect(crearIdentidad(s).leer()).toBeNull();
  });
});

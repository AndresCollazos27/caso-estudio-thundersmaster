// Lo que alguien está escribiendo queda en su celular hasta que lo envía, por si se recarga la página.
// Si el navegador no deja guardar (modo privado, datos bloqueados), todo sigue funcionando sin borradores.
const PREFIJO = 'tomatera:borrador:';

export interface Borradores {
  leer(k: string): string;
  guardar(k: string, v: string): void;
  borrar(k: string): void;
}

export function crearBorradores(storage: Storage | null): Borradores {
  return {
    leer(k) {
      try {
        return storage?.getItem(PREFIJO + k) ?? '';
      } catch {
        return '';
      }
    },
    guardar(k, v) {
      try {
        storage?.setItem(PREFIJO + k, v);
      } catch {
        // Sin espacio o bloqueado: el texto sigue en pantalla.
      }
    },
    borrar(k) {
      try {
        storage?.removeItem(PREFIJO + k);
      } catch {
        // Nada que hacer.
      }
    },
  };
}

// Los borradores de una persona en una sesión, para que no se mezclen con los de otra.
export const conPrefijo = (b: Borradores, prefijo: string): Borradores => ({
  leer: (k) => b.leer(prefijo + k),
  guardar: (k, v) => b.guardar(prefijo + k, v),
  borrar: (k) => b.borrar(prefijo + k),
});

// El localStorage del navegador, o null si ni siquiera se puede consultar.
export function almacenLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

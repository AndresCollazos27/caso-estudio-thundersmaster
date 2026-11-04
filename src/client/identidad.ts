// Quién es este celular en la sesión, para volver a entrar sin unirse de nuevo si se recarga la página.
const CLAVE = 'tomatera:identidad';

export interface Identidad {
  sesionId: string;
  participanteId: string;
  // Secreto que entregó el servidor al unirse: sin él no se puede entrar como esta persona.
  clave: string;
  codigo: string;
}

export function crearIdentidad(storage: Storage | null) {
  return {
    leer(): Identidad | null {
      try {
        const x = JSON.parse(storage?.getItem(CLAVE) ?? 'null') as Partial<Identidad> | null;
        const valida = x && [x.sesionId, x.participanteId, x.clave, x.codigo].every((c) => typeof c === 'string');
        return valida ? { sesionId: x.sesionId!, participanteId: x.participanteId!, clave: x.clave!, codigo: x.codigo! } : null;
      } catch {
        return null;
      }
    },
    guardar(i: Identidad): void {
      try {
        storage?.setItem(CLAVE, JSON.stringify(i));
      } catch {
        // Sin almacenamiento: la identidad dura mientras la página siga abierta.
      }
    },
    borrar(): void {
      try {
        storage?.removeItem(CLAVE);
      } catch {
        // Nada que hacer.
      }
    },
  };
}

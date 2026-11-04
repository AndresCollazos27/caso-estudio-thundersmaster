import type { Rol } from './valores.js';

export interface MesaRepartida {
  ids: string[];
  carmen: string | null;
}

export interface Reparto {
  mesas: MesaRepartida[];
  espectadores: string[];
}

export class ErrorReparto extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorReparto';
  }
}

// Mesas provisionales de seis en orden de llegada; al cerrar se reparte lo que sobra
// moviendo a la menor cantidad de gente (sección 6 del diseño del software).
export function repartirMesas(llegadas: string[]): Reparto {
  const n = llegadas.length;
  if (n < 5) throw new ErrorReparto('Se necesitan al menos 5 personas para cerrar la inscripción');
  if (n === 8 || n === 9) {
    return { mesas: [{ ids: llegadas.slice(0, 7), carmen: llegadas[6] }], espectadores: llegadas.slice(7) };
  }

  const completas = Math.floor(n / 6);
  const resto = llegadas.slice(completas * 6);
  const mesas: MesaRepartida[] = [];
  for (let i = 0; i < completas; i++) mesas.push({ ids: llegadas.slice(i * 6, i * 6 + 6), carmen: null });

  if (resto.length === 0) return { mesas, espectadores: [] };

  if (resto.length <= completas) {
    resto.forEach((id, k) => {
      const mesa = mesas[completas - resto.length + k];
      mesa.ids.push(id);
      mesa.carmen = id;
    });
    return { mesas, espectadores: [] };
  }

  const nueva: MesaRepartida = { ids: [...resto], carmen: null };
  if (resto.length < 5) {
    for (let k = 0; k < 5 - resto.length; k++) {
      const donante = mesas[completas - 1 - k];
      nueva.ids.push(donante.ids.pop() as string);
    }
  }
  mesas.push(nueva);
  return { mesas, espectadores: [] };
}

export function rolesParaTamano(n: 5 | 6 | 7): Rol[][] {
  if (n === 5) return [['PO'], ['SD'], ['AN'], ['QA'], ['FR', 'RT']];
  const seis: Rol[][] = [['PO'], ['SD'], ['FR'], ['AN'], ['QA'], ['RT']];
  return n === 6 ? seis : [...seis, ['SD2']];
}

export function asignarRoles(mesa: MesaRepartida, azar: () => number): Record<string, Rol[]> {
  const ranuras = rolesParaTamano(mesa.ids.length as 5 | 6 | 7);
  const resultado: Record<string, Rol[]> = {};
  let personas = [...mesa.ids];
  let libres = ranuras;
  if (mesa.carmen) {
    resultado[mesa.carmen] = ['SD2'];
    personas = personas.filter((id) => id !== mesa.carmen);
    libres = ranuras.filter((r) => !(r.length === 1 && r[0] === 'SD2'));
  }
  const barajadas = [...personas];
  for (let i = barajadas.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]];
  }
  barajadas.forEach((id, i) => { resultado[id] = libres[i]; });
  return resultado;
}

export function ubicarTarde(
  mesas: { numero: number; miembros: Record<string, Rol[]> }[],
): { mesa: number; roles: Rol[]; liberar?: { id: string; roles: Rol[] } } | null {
  const ordenadas = [...mesas].sort((a, b) => a.numero - b.numero);
  for (const m of ordenadas) {
    const doble = Object.entries(m.miembros).find(([, roles]) => roles.includes('FR') && roles.includes('RT'));
    if (doble) return { mesa: m.numero, roles: ['RT'], liberar: { id: doble[0], roles: ['FR'] } };
  }
  const deSeis = ordenadas.filter((m) => Object.keys(m.miembros).length === 6);
  if (deSeis.length > 0) return { mesa: deSeis[0].numero, roles: ['SD2'] };
  return null;
}

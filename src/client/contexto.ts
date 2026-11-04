import { createContext, useContext } from 'react';
import type { DatosComando, TipoComando } from '../shared/comandos.js';
import type { VistaJugador } from '../shared/vistas.js';
import type { Borradores } from './borradores.js';
import type { Respuesta } from './conexion.js';

export type VistaMesa = NonNullable<VistaJugador['mesa']>;
export type Enviar = <K extends TipoComando>(tipo: K, datos: DatosComando<K>) => Promise<Respuesta>;

export interface ContextoMesa {
  v: VistaJugador;
  enviar: Enviar;
  // Ya con el prefijo de la sesión y la persona.
  borradores: Borradores;
}

export const Contexto = createContext<ContextoMesa | null>(null);

export function usarMesa(): ContextoMesa & { m: VistaMesa } {
  const c = useContext(Contexto);
  if (!c || !c.v.mesa) throw new Error('usarMesa va dentro de una mesa');
  return { ...c, m: c.v.mesa };
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearConexion, type Auth, type Conexion, type EstadoConexion } from './conexion.js';

// Una conexión por pantalla; se cierra al salir o cuando cambia la identidad.
export function usarConexion(auth: Auth | null): Conexion | null {
  const [con, setCon] = useState<Conexion | null>(null);
  const clave = auth ? JSON.stringify(auth) : '';
  useEffect(() => {
    if (!auth) return;
    const c = crearConexion(auth);
    setCon(c);
    return () => {
      c.cerrar();
      setCon(null);
    };
    // La conexión depende solo de los datos de auth, no del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return con;
}

const VACIO: EstadoConexion = { vista: null, conectado: false, error: null };
const sinSuscripcion = () => () => {};
const vacio = () => VACIO;

export function usarEstado(con: Conexion | null): EstadoConexion {
  return useSyncExternalStore(con ? con.alCambiar : sinSuscripcion, con ? con.estado : vacio);
}

// Vuelve a dibujar cada `ms` milisegundos, para el cronómetro.
export function usarTic(ms = 250): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

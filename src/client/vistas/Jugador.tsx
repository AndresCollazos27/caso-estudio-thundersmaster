import { useEffect, useMemo, useState } from 'react';
import type { VistaJugador } from '../../shared/vistas.js';
import { almacenLocal } from '../borradores.js';
import { crearIdentidad, type Identidad } from '../identidad.js';
import { usarConexion, usarEstado } from '../usarConexion.js';
import { Mesa } from './Mesa.js';
import { Unirse } from './Unirse.js';

// El celular: si ya se unió a esta sesión, vuelve a entrar solo; si no, muestra la pantalla para unirse.
export function Jugador() {
  const codigo = new URLSearchParams(window.location.search).get('c')?.trim() ?? '';
  const identidad = useMemo(() => crearIdentidad(almacenLocal()), []);
  const [yo, setYo] = useState<Identidad | null>(() => {
    const i = identidad.leer();
    return i && (!codigo || i.codigo === codigo) ? i : null;
  });
  const con = usarConexion(yo ? { tipo: 'jugador', sesionId: yo.sesionId, participanteId: yo.participanteId, clave: yo.clave } : null);
  const estado = usarEstado(con);

  useEffect(() => {
    // La sesión ya no existe en el servidor: hay que unirse de nuevo.
    if (estado.error === 'Sesión o participante desconocido') {
      identidad.borrar();
      setYo(null);
    }
  }, [estado.error, identidad]);

  if (!yo) {
    return <Unirse codigoInicial={codigo} onUnido={(i) => { identidad.guardar(i); setYo(i); }} />;
  }
  const v = estado.vista as VistaJugador | null;
  if (!v || !con) {
    return (
      <main className="cel">
        <div className="unirse">
          <p className="logo">Tomatera</p>
          <p>{estado.error ? 'No se pudo conectar. Reintentando…' : 'Conectando…'}</p>
        </div>
      </main>
    );
  }
  return <Mesa v={v} con={con} conectado={estado.conectado} />;
}

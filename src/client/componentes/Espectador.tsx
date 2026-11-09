import type { VistaJugador } from '../../shared/vistas.js';
import { textoRoles } from '../../shared/roles.js';
import { Ahora } from './Ahora.js';

// Quien llegó cuando las mesas ya estaban completas: mira y aprende, sin escribir en ninguna plantilla.
export function Espectador({ v }: { v: VistaJugador }) {
  return (
    <main className="cuerpo">
      <p className="paso">{v.sesion.nombreTramo}</p>
      <Ahora textos={['Esta vez miras como espectador. Acércate a una mesa y observa cómo trabajan.', textoRoles(v.ahora.paraTodos)]} />
      <p className="nota">Si se libera un lugar, los autores pueden sentarte en una mesa.</p>
    </main>
  );
}

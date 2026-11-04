import { formatoReloj } from '../../shared/tiempo.js';
import type { VistaJugador } from '../../shared/vistas.js';
import { restanteAhora } from '../conexion.js';
import { colorRol, etiquetaRol } from '../textos.js';
import { usarTic } from '../usarConexion.js';

// Siempre arriba: la mesa, el rol y lo que queda del tramo, con la hora del servidor.
export function BarraMesa({ v, conectado, desfaseMs }: { v: VistaJugador; conectado: boolean; desfaseMs: number }) {
  const ahora = usarTic(500);
  const s = v.sesion;
  const restante = restanteAhora(s.restanteMs, s.ahoraServidor, s.pausada, desfaseMs, ahora);
  const conReloj = s.estado === 'en_curso' && s.tramo !== null;
  return (
    <header className="barra">
      <span className="mesa">
        {v.yo.mesa !== null ? `Mesa ${v.yo.mesa}` : 'Tomatera'}
        {v.yo.roles.map((r) => (
          <span key={r} className="rol" style={{ background: colorRol(v.roles, r) }}>{etiquetaRol(v.roles, r)}</span>
        ))}
      </span>
      <span className="der">
        {conReloj && (
          <span className={`reloj${restante < 0 && !s.pausada ? ' tarde' : ''}`} aria-label="Tiempo que queda del tramo">
            {s.pausada ? 'En pausa' : formatoReloj(restante)}
          </span>
        )}
        <span className={`punto${conectado ? '' : ' off'}`} role="img" aria-label={conectado ? 'Conectado' : 'Sin conexión; reconectando'} />
      </span>
    </header>
  );
}

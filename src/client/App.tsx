import { Autores } from './vistas/Autores.js';
import { Entrevista } from './vistas/Entrevista.js';
import { Imprimir } from './vistas/Imprimir.js';
import { Jugador } from './vistas/Jugador.js';
import { Leandro } from './vistas/Leandro.js';

// Cada ruta es una vista distinta; ver la tabla de rutas del diseño del software.
export function App() {
  const ruta = window.location.pathname.replace(/\/+$/, '') || '/';
  if (ruta === '/') return <Jugador />;
  if (ruta === '/leandro') return <Leandro />;
  if (ruta === '/leandro/entrevista') return <Entrevista />;
  if (ruta === '/autores') return <Autores />;
  if (ruta === '/imprimir' || ruta.startsWith('/imprimir/')) return <Imprimir />;
  return (
    <main className="cel">
      <div className="unirse">
        <p className="logo">Tomatera</p>
        <p>Esta dirección no existe. Escanea el QR de la pantalla para unirte.</p>
      </div>
    </main>
  );
}

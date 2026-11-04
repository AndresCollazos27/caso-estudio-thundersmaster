import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cargarContenido, ErrorContenido, type Contenido } from '../shared/contenido.js';
import { idAzar } from '../shared/ids.js';
import { Almacen } from './almacen.js';
import { crearApp } from './app.js';
import { GestorSesiones } from './gestor.js';

// Las rutas se resuelven desde la carpeta en la que se arranca (la del proyecto), igual en desarrollo y en producción.
const ARCHIVO_CONTENIDO = 'content/caso-tomatera.yaml';
const TICK_MS = 500;

function clave(nombre: 'HOST_TOKEN' | 'ADMIN_TOKEN'): string {
  const valor = process.env[nombre]?.trim();
  if (valor) return valor;
  const temporal = idAzar(18);
  console.warn(`[tomatera] ${nombre} no está definido; se usa una clave temporal que cambia en cada arranque.`);
  return temporal;
}

function leerContenido(): Contenido {
  try {
    return cargarContenido(readFileSync(resolve(ARCHIVO_CONTENIDO), 'utf8'));
  } catch (e) {
    if (e instanceof ErrorContenido) {
      const donde = e.linea ? `, línea ${e.linea}` : '';
      console.error(`[tomatera] ${ARCHIVO_CONTENIDO}${donde} (${e.ruta}): ${e.message}`);
    } else {
      console.error(`[tomatera] no se pudo leer ${ARCHIVO_CONTENIDO}:`, e);
    }
    process.exit(1);
  }
}

const puerto = Number(process.env.PORT ?? 8090);
const publicUrl = (process.env.PUBLIC_URL?.trim() || `http://localhost:${puerto}`).replace(/\/+$/, '');
const hostToken = clave('HOST_TOKEN');
const adminToken = clave('ADMIN_TOKEN');

const almacen = new Almacen(resolve(process.env.DATA_DIR ?? './data'));
const gestor = new GestorSesiones({ almacen, contenidoBase: leerContenido() });
gestor.cargar();

const app = crearApp({ gestor, hostToken, adminToken, publicUrl, dirCliente: resolve('dist/client') });
const reloj = setInterval(() => {
  try {
    app.tick();
  } catch (e) {
    console.error('[tomatera] error en el reloj', e);
  }
}, TICK_MS);

app.http.listen(puerto, '0.0.0.0', () => {
  console.log(`[tomatera] escuchando en el puerto ${puerto}`);
  console.log(`[tomatera] pantalla de Leandro: ${publicUrl}/leandro?k=${hostToken}`);
  console.log(`[tomatera] vista de los autores: ${publicUrl}/autores?k=${adminToken}`);
});

let cerrando = false;
async function apagar(senal: string) {
  if (cerrando) return;
  cerrando = true;
  console.log(`[tomatera] ${senal}: cerrando`);
  clearInterval(reloj);
  await app.cerrar();
  almacen.cerrar();
  process.exit(0);
}
process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));

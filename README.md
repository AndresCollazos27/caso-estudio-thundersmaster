# Tomatera

App de apoyo del estudio de caso Tomatera de THUNDERS Master. Guía una sesión de 60 minutos como un Kahoot: los estudiantes entran desde el celular escaneando un QR, Leandro proyecta el tramo, el cronómetro y el avance de cada mesa, y los autores siguen todo a distancia. Cada acción queda en un registro de eventos que, al final, se exporta y llena una copia del libro de plantillas por mesa.

Nada se graba (ni audio ni video). El registro guarda lo que cada persona escribe y marca con un identificador anónimo, sin direcciones IP. El apodo queda en el servidor, pero no sale en la exportación.

## Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `src/server` | Servidor Node.js: HTTP, Socket.IO, reloj, simulador y exportación |
| `src/shared` | Reglas compartidas: contenido, permisos, eventos, reductor, lecturas E1–E5 y vistas |
| `src/client` | La app web (React): celular, pantalla de Leandro, vista de autores e impresión |
| `content/caso-tomatera.yaml` | Todo el contenido del caso: cartas, agenda, plantillas, rondas, medición, cuestionario y destape |
| `plantilla/` | El libro de plantillas de la versión final, que usa la herramienta de Python |
| `tools/llenar_libro.py` | Llena un libro por mesa y crea los CSV a partir de una exportación |
| `deploy/tomatera.service` | Servicio de systemd para correr sin Docker |

## Requisitos

- Un VPS con Linux, IP pública y un puerto libre (8090 por defecto). La app es un proyecto aparte: su propia carpeta, su contenedor y su puerto, sin tocar otras apps.
- Docker con Compose, o Node.js 22.
- En el computador de los autores, para la herramienta del libro: Python 3.10 o más nuevo, con openpyxl.

## Instalación con Docker

1. Copie esta carpeta al VPS, por ejemplo en `/opt/tomatera`.
2. Cree el archivo de configuración y edítelo: `cp .env.example .env`. Cambie `PUBLIC_URL` (la IP pública y el puerto), `HOST_TOKEN` y `ADMIN_TOKEN` (claves largas, por ejemplo con `openssl rand -base64 24`).
3. Cree la carpeta de datos con el dueño del contenedor: `mkdir -p data && sudo chown 1000:1000 data`.
4. Levante la app: `docker compose up -d --build`.
5. Lea los enlaces secretos: `docker compose logs tomatera`. Ahí aparecen la pantalla de Leandro y la vista de los autores.

Para actualizar después de cambiar el contenido o el código: `docker compose up -d --build`. Las sesiones existentes conservan la copia del contenido con la que se crearon.

## Instalación sin Docker

1. Instale Node.js 22.
2. En la carpeta: `npm ci` y luego `npm run build`.
3. Cree el `.env` como arriba.
4. Pruébela: `set -a; . ./.env; set +a; node dist/node/server/index.js`.
5. Para dejarla como servicio: cree el usuario `tomatera`, copie la carpeta a `/opt/tomatera`, copie `deploy/tomatera.service` a `/etc/systemd/system/` y ejecute `sudo systemctl enable --now tomatera`. Los enlaces salen en `journalctl -u tomatera`.

## Abrir el puerto

Con `ufw`, abra solo ese puerto: `sudo ufw allow 8090/tcp`. Compruébelo desde un celular con datos móviles, fuera de la red del VPS, entrando a `http://IP:8090`.

## Los enlaces

| Quién | Enlace |
|---|---|
| Estudiantes | `PUBLIC_URL/?c=CÓDIGO`, que es lo que lleva el QR |
| Leandro, pantalla proyectada | `PUBLIC_URL/leandro?k=HOST_TOKEN` |
| Leandro, notas de la entrevista (no se proyecta) | `PUBLIC_URL/leandro/entrevista?k=HOST_TOKEN` |
| Autores | `PUBLIC_URL/autores?k=ADMIN_TOKEN` |
| Impresión | Desde la vista de los autores, con la sesión elegida |

Las claves son la única protección de las pantallas de Leandro y de los autores: no las proyecte ni las comparta en un grupo.

## Crear la sesión real

1. Entre a la vista de los autores y cree una sesión «Real (la del aula)».
2. En «Enlaces» copie el de la pantalla de Leandro: ya lleva la sesión fijada. Envíeselo a Leandro por un canal privado.
3. Desde «Para imprimir», imprima el respaldo: cartas (una por sobre), hojas de rol, plantillas, medición, cuestionario, QR y carteles de mesa.

Antes, ensaye con una sesión de prueba ×60: «Simular 36 participantes», cierre la inscripción, empiece y deje que llegue al cierre. Después exporte y corra la herramienta del libro.

## Lista del día de la sesión

- **La víspera:** sesión de prueba ×10 con 35 simulados y al menos un celular real. Recorrer los diez tramos, exportar y correr `llenar_libro.py`.
- **El aviso de Chrome en Android:** la app va por http, sin certificado. En un Android con Chrome, abra `PUBLIC_URL` y únase a una sesión de prueba. Chrome marca el sitio como «No seguro», y con el modo «Usar siempre conexiones seguras» puede mostrar una página de aviso con «Continuar al sitio». Si aparece, Leandro debe decirlo al empezar: «Si el celular dice que el sitio no es seguro, toquen Continuar». Pruébelo también con un iPhone.
- **La red del aula:** compruebe desde el wifi del aula que un celular llega a `http://IP:PUERTO`. Algunas redes universitarias bloquean puertos poco comunes.
- **El computador de Leandro:** conectado al proyector y a la corriente, con la suspensión y el protector de pantalla desactivados, y Chrome en pantalla completa (F11) con la pantalla de Leandro.
- **Los autores:** con la vista de los autores abierta durante toda la sesión.

## Después de la sesión

1. En la vista de los autores, «Exportar todo (JSON)». El archivo se llama `tomatera-CÓDIGO-AAAAMMDD-HHmm.json`.
2. En el computador de los autores: `pip install -r tools/requirements.txt` y luego `python tools/llenar_libro.py tomatera-CÓDIGO-….json salida/`. Quedan `mesa-01.xlsx`, `mesa-02.xlsx`… y los CSV `medicion.csv`, `rondas.csv`, `divergencias.csv`, `cuestionario.csv`, `celdas_por_requisito.csv` y `eventos.csv`.
3. Abra cada libro en Excel para que se recalculen E1 a E5. openpyxl descarta las listas desplegables que dependen de otras hojas, pero los valores y las fórmulas se conservan.
4. Respalde la carpeta `data`: `tar czf tomatera-data-AAAAMMDD.tgz data`. Guárdela con cuidado: a diferencia de la exportación, el registro en bruto conserva los apodos y las claves de los celulares. Cuando ya no se necesite, bórrela del VPS.
5. Si no se va a usar más, apague la app: `docker compose down`.

`celdas_por_requisito.csv` cuenta, por mesa, los campos que el equipo escribió o marcó, con las reglas de la hoja Ligereza, y los divide por el número de tarjetas. No cuenta lo que llega prellenado con el caso (canvas, mapa, declaración, plan de I3 y términos semilla sin editar) ni lo automático. El archivo trae el desglose por plantilla. Las horas de los CSV y del libro van en UTC.

## Problemas comunes

- **El puerto está ocupado:** `ss -ltnp | grep 8090` dice qué lo usa. Elija otro `PORT` y cambie también `PUBLIC_URL` en el `.env`; después, `docker compose up -d`.
- **`PUBLIC_URL` mal escrita:** el QR lleva a otra dirección. Tiene que ser `http://IP:PUERTO`, sin barra al final. Después de corregirla, reinicie la app.
- **El computador de Leandro se durmió:** la sesión sigue en el servidor, porque el reloj corre ahí. Al despertarlo, recargue la página de Leandro.
- **Un celular perdió la conexión:** se reconecta solo. Lo que estaba escribiendo y no envió queda como borrador en ese celular.
- **El servidor se reinició:** la sesión sigue donde estaba, porque cada acción se guarda en disco al momento.
- **Alguien llegó tarde:** se une igual. Si hay lugar, ocupa el de RT en una mesa de cinco o el de Carmen en una de seis; si no, queda como espectador. Los autores pueden moverlo de mesa o de rol.
- **Hay que corregir algo de una mesa:** desde la vista de los autores se puede reabrir un tramo en una mesa, repetir una ronda o mover a alguien.

## Para desarrollar

- `npm install`, y luego `npm run dev` (servidor en el puerto 8090) y `npx vite` (cliente en el 5173, que pasa `/api` y `/socket.io` al servidor). O `npm run build` y abrir el servidor directamente.
- Pruebas: `npm test`, `npm run typecheck` y `python -m unittest tools/test_llenar_libro.py`.
- El contenido del caso se cambia en `content/caso-tomatera.yaml`. Si el archivo tiene un error, el servidor no arranca y dice en qué línea está.

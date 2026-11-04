import { useEffect, useState } from 'react';
import type { TipoComando } from '../../shared/comandos.js';
import { formatoReloj } from '../../shared/tiempo.js';
import type { ResumenMesa, VistaLeandro } from '../../shared/vistas.js';
import { restanteAhora, type Conexion } from '../conexion.js';
import { LineaDeTiempo } from '../componentes/LineaDeTiempo.js';
import { Qr } from '../componentes/Qr.js';
import { minutoActual } from '../textos.js';
import { usarConexion, usarEstado, usarTic } from '../usarConexion.js';

// La pantalla que proyecta Leandro. Nunca muestra lo que escribió cada mesa: solo su avance.
export function Leandro() {
  const q = new URLSearchParams(window.location.search);
  const k = q.get('k') ?? '';
  const con = usarConexion(k ? { tipo: 'leandro', k, sesionId: q.get('s') ?? undefined } : null);
  const estado = usarEstado(con);
  const v = estado.vista as VistaLeandro | null;
  if (!k) return <Aviso texto="Falta la clave en el enlace. Usa el enlace que te mandaron los autores." />;
  if (!v || !con) {
    const texto = estado.error === 'Clave incorrecta' ? 'La clave del enlace no es correcta.' : estado.error ?? 'Conectando…';
    return <Aviso texto={texto} />;
  }
  return <Proyeccion v={v} con={con} conectado={estado.conectado} />;
}

function Aviso({ texto }: { texto: string }) {
  return (
    <main className="proy">
      <p className="p-marca">Tomatera</p>
      <p className="p-texto">{texto}</p>
    </main>
  );
}

function Proyeccion({ v, con, conectado }: { v: VistaLeandro; con: Conexion; conectado: boolean }) {
  const ahora = usarTic(250);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Tras «Siguiente tramo», el botón espera a que llegue el tramo nuevo: un segundo clic no salta otro tramo.
  const [esperandoDesde, setEsperandoDesde] = useState<number | null | undefined>(undefined);
  const s = v.sesion;
  useEffect(() => setEsperandoDesde(undefined), [s.tramoIndice]);
  const restante = restanteAhora(s.restanteMs, s.ahoraServidor, s.pausada, con.desfaseMs(), ahora);
  const minuto = minutoActual(s, restante);
  async function hacer(tipo: TipoComando, datos: unknown = {}): Promise<boolean> {
    setEnviando(true);
    const r = await con.enviar(tipo, datos);
    setEnviando(false);
    setError(r.ok ? null : r.error);
    return r.ok;
  }
  async function avanzar() {
    if (s.tramoIndice === s.agenda.length - 1 && !window.confirm('¿Terminar la sesión? Después no se puede volver atrás.')) return;
    setEsperandoDesde(s.tramoIndice);
    if (!(await hacer('avanzarTramo', { desde: s.tramoIndice }))) setEsperandoDesde(undefined);
  }
  const avanzando = enviando || esperandoDesde !== undefined;
  const abierta = s.tramo === 'a51' ? v.mesas.find((m) => m.ronda && !m.ronda.revelada)?.ronda ?? null : null;
  const rondaAbierta = abierta?.numero ?? null;
  // Durante una ronda, la cuenta de 60 segundos reemplaza al cronómetro del tramo.
  const cuenta = abierta ? Math.max(0, abierta.terminaEn - (ahora + con.desfaseMs())) : null;
  const proximaRonda = s.tramo === 'a51' ? ([1, 2] as const).find((n) => !v.rondasLanzadas.includes(n)) : undefined;

  let cuerpo;
  if (!s.inscripcionCerrada) cuerpo = <Inscripcion v={v} hacer={hacer} enviando={enviando} />;
  else if (s.tramoIndice === null) cuerpo = <Listos v={v} avanzar={avanzar} enviando={avanzando} />;
  else if (s.estado === 'cerrada') cuerpo = <Cierre />;
  else if (s.tramo === 'destape' && v.destape) {
    cuerpo = (
      <>
        <div className="p-top">
          <p className="p-etq">{s.nombreTramo}</p>
          <p className="p-suave p-mono">minuto {Math.floor(minuto)} de 60 · {s.pausada ? 'en pausa' : formatoReloj(Math.max(0, restante))}</p>
        </div>
        <p className="p-grande">¿Cuáles encontró tu mesa?</p>
        <div className="p-lista">{v.destape.map((t) => <div key={t.id}><b>{t.id} · {t.titulo}</b><p>{t.detalle}</p></div>)}</div>
        <div className="p-controles">
          <button type="button" className="p-btn fantasma" disabled={enviando} onClick={() => hacer(s.pausada ? 'reanudar' : 'pausar')}>{s.pausada ? 'Reanudar' : 'Pausar'}</button>
          <button type="button" className="p-btn fantasma" disabled={avanzando} onClick={avanzar}>Terminar la sesión</button>
        </div>
      </>
    );
  } else {
    cuerpo = (
      <>
        <div className="p-top">
          <p className="p-etq">{rondaAbierta ? `Ronda ${rondaAbierta} de sondeo` : `Tramo ${s.tramoIndice + 1} de ${s.agenda.length}`}</p>
          <p className="p-suave p-mono">minuto {Math.floor(minuto)} de 60</p>
        </div>
        <p className="p-grande">{rondaAbierta ? 'Respondan solos y en silencio' : s.nombreTramo}</p>
        <p className={`crono${restante < 0 && !s.pausada && cuenta === null ? ' tarde' : ''}`}>
          {s.pausada ? 'En pausa' : formatoReloj(cuenta ?? Math.max(0, restante))}
        </p>
        {restante < 0 && !s.pausada && cuenta === null && <p className="p-aviso">Tiempo: pasa al siguiente tramo (+{formatoReloj(-restante)})</p>}
        <p className="p-texto">{rondaAbierta ? 'Las preguntas están en el celular. Cuando responda toda la mesa, verán las respuestas juntas.' : v.paraTodos}</p>
        <LineaDeTiempo s={s} minuto={minuto} />
        <div className="p-chips">{v.mesas.map((m) => <p key={m.numero} className="p-chip"><b>Mesa {m.numero}</b>{avance(m, s.tramo, rondaAbierta)}</p>)}</div>
        <div className="p-controles">
          {proximaRonda && !rondaAbierta && (
            <button type="button" className="p-btn" disabled={enviando} onClick={() => hacer('lanzarRonda', { numero: proximaRonda })}>Lanzar ronda {proximaRonda}</button>
          )}
          <button type="button" className="p-btn fantasma" disabled={enviando} onClick={() => hacer(s.pausada ? 'reanudar' : 'pausar')}>{s.pausada ? 'Reanudar' : 'Pausar'}</button>
          <button type="button" className="p-btn fantasma" disabled={avanzando} onClick={avanzar}>
            {s.tramoIndice === s.agenda.length - 1 ? 'Terminar la sesión' : 'Siguiente tramo'}
          </button>
        </div>
      </>
    );
  }
  return (
    <main className="proy">
      {cuerpo}
      {error && <p className="p-aviso" role="alert">{error}</p>}
      {!conectado && <p className="p-aviso" role="status">Sin conexión con el servidor; reconectando…</p>}
    </main>
  );
}

// El avance de cada mesa, sin contenido: lo que importa en ese tramo.
function avance(m: ResumenMesa, tramo: string | null, ronda: number | null): string {
  if (ronda && m.ronda && m.ronda.numero === ronda) return m.ronda.revelada ? 'Respuestas a la vista' : `${m.ronda.respondieron} de ${m.ronda.total} respondieron`;
  switch (tramo) {
    case 'a4': return `${m.divergencias} divergencia${m.divergencias === 1 ? '' : 's'}`;
    case 'a51': return `${m.necesidades} necesidades · ${m.terminos} términos`;
    case 'a52': return `${m.tarjetas} tarjetas`;
    case 'a53': return `${m.tarjetas} tarjetas · ${m.divergencias} divergencias`;
    case 'a6': return m.congelada ? 'Línea base congelada' : 'Sin congelar';
    default: return `${m.conectados} de ${m.personas} conectados`;
  }
}

type Hacer = (tipo: TipoComando, datos?: unknown) => Promise<boolean>;

function Inscripcion({ v, hacer, enviando }: { v: VistaLeandro; hacer: Hacer; enviando: boolean }) {
  return (
    <>
      <div className="p-top">
        <p className="p-marca">Tomatera<span>Sesión {v.sesion.codigo}</span></p>
        <p className="p-suave">{v.conectados} conectados</p>
      </div>
      <div className="lobby">
        <div className="qr">
          <p className="p-etq">Escanea para unirte</p>
          <Qr texto={v.enlace} etiqueta={`Código QR para unirse a la sesión ${v.sesion.codigo}`} />
          <p className="url">{v.enlace.replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="p-mesas">
          <p className="p-etq">Mesas, en orden de llegada</p>
          {v.mesas.length === 0 && <p className="p-suave">Todavía no hay nadie.</p>}
          {v.mesas.map((m) => <FilaMesa key={m.numero} m={m} />)}
          <p className="p-suave">Código de la sesión: <span className="p-mono">{v.sesion.codigo}</span></p>
          <div className="p-controles">
            <button type="button" className="p-btn" disabled={enviando || v.inscritos < 5} onClick={() => hacer('cerrarInscripcion')}>Cerrar inscripción y repartir roles</button>
          </div>
        </div>
      </div>
    </>
  );
}

function Listos({ v, avanzar, enviando }: { v: VistaLeandro; avanzar: () => void; enviando: boolean }) {
  return (
    <>
      <div className="p-top">
        <p className="p-marca">Tomatera<span>Sesión {v.sesion.codigo}</span></p>
        <p className="p-suave">{v.conectados} conectados</p>
      </div>
      <div className="lobby">
        <div className="qr">
          <p className="p-etq">¿Llegaste tarde? Escanea igual</p>
          <Qr texto={v.enlace} etiqueta={`Código QR para unirse a la sesión ${v.sesion.codigo}`} />
          <p className="url">{v.enlace.replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="p-mesas">
          <p className="p-grande">Busquen su mesa</p>
          <p className="p-texto">{v.paraTodos}</p>
          {v.mesas.map((m) => <FilaMesa key={m.numero} m={m} />)}
          <div className="p-controles">
            <button type="button" className="p-btn" disabled={enviando} onClick={avanzar}>Empezar la sesión</button>
          </div>
        </div>
      </div>
    </>
  );
}

function FilaMesa({ m }: { m: ResumenMesa }) {
  return (
    <div className="p-fila">
      <span>Mesa {m.numero}</span>
      <span className="puntos" aria-label={`${m.conectados} de ${m.personas} conectados`}>
        {Array.from({ length: m.personas }, (_, i) => <i key={i} className={i < m.conectados ? '' : 'off'} />)}
      </span>
      <span className="p-mono">{m.personas}</span>
    </div>
  );
}

function Cierre() {
  return (
    <>
      <p className="p-marca">Tomatera</p>
      <p className="p-grande">Gracias por participar</p>
      <p className="p-texto">Respondan el cuestionario en su celular antes de irse. Son cinco afirmaciones, seis barras y una pregunta abierta.</p>
      <p className="p-suave">Leandro: las notas de la entrevista con los FR van en la pestaña «entrevista», que no se proyecta.</p>
    </>
  );
}

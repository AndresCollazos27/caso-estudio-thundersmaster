import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { TipoComando } from '../../shared/comandos.js';
import type { Evento } from '../../shared/eventos.js';
import { nombreRol, textoRoles } from '../../shared/roles.js';
import { formatoReloj } from '../../shared/tiempo.js';
import type { EstadoDeSesion, Mesa } from '../../shared/tipos.js';
import { ROLES, type Rol, type TramoId } from '../../shared/valores.js';
import type { VistaAutores } from '../../shared/vistas.js';
import { restanteAhora, type Conexion } from '../conexion.js';
import { minutoActual } from '../textos.js';
import { usarConexion, usarEstado, usarTic } from '../usarConexion.js';

type Vista = VistaAutores & { registro: Evento[]; enlaceBase: string; enlaceLeandro: string };

interface ResumenSesion {
  id: string;
  codigo: string;
  prueba: boolean;
  velocidad: number;
  creadaEn: number;
  estado: string;
  inscritos: number;
}

const TRAMOS_REABRIBLES: TramoId[] = ['a4', 'a51', 'a52', 'a53', 'a6'];

// La vista de los autores, a distancia: todo lo de Leandro y, además, corregir, simular y exportar.
export function Autores() {
  const q = new URLSearchParams(window.location.search);
  const k = q.get('k') ?? '';
  const [inicial] = useState(() => q.get('s') ?? undefined);
  const [elegida, setElegida] = useState<string | null>(inicial ?? null);
  const con = usarConexion(k ? { tipo: 'autores', k, sesionId: elegida ?? undefined } : null);
  const estado = usarEstado(con);
  const [sesiones, setSesiones] = useState<ResumenSesion[]>([]);
  const [seleccionando, setSeleccionando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seleccionPendiente = useRef(false);
  const operacionPendiente = useRef(false);

  function marcarOcupado(valor: boolean) {
    operacionPendiente.current = valor;
    setOcupado(valor);
  }

  useEffect(() => (con ? con.escuchar('sesiones', (x) => setSesiones(x as ResumenSesion[])) : undefined), [con]);

  async function elegir(id: string): Promise<boolean> {
    if (!con || operacionPendiente.current || seleccionPendiente.current) return false;
    seleccionPendiente.current = true;
    setSeleccionando(true);
    setError(null);
    try {
      const r = await con.emitir<{ ok: boolean; error?: string }>('seleccionar', { sesionId: id });
      if (!r.ok) {
        setError(r.error ?? 'No se pudo abrir la sesión');
        return false;
      }
      setElegida(id);
      const url = new URL(window.location.href);
      url.searchParams.set('s', id);
      window.history.replaceState(null, '', url);
      return true;
    } catch {
      setError('No se pudo abrir la sesión. Revisa la conexión e inténtalo de nuevo.');
      return false;
    } finally {
      seleccionPendiente.current = false;
      setSeleccionando(false);
    }
  }

  // Sin sesión elegida, se abre la más reciente.
  useEffect(() => {
    if (con && estado.conectado && !elegida && !operacionPendiente.current && sesiones.length > 0) void elegir(sesiones[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [con, estado.conectado, elegida, sesiones]);

  if (!k) return <Marco><p className="error">Falta la clave en el enlace.</p></Marco>;
  if (estado.error === 'Clave incorrecta') return <Marco><p className="error">La clave del enlace no es correcta.</p></Marco>;
  const v = estado.vista as Vista | null;
  return (
    <div className="esc">
      <BarraAutores v={v} con={con} conectado={estado.conectado} />
      <nav className="autores-atajos" aria-label="Secciones de autores">
        <a href="#control-sesion">Controles</a><a href="#mesas-sesion">Mesas</a><a href="#materiales-sesion">Materiales y resultados</a>
      </nav>
      {error && <p className="error autores-aviso" role="alert">{error}</p>}
      {seleccionando && <p className="nota autores-aviso" role="status">Abriendo la sesión…</p>}
      <div className="esc-main">
        <div className="esc-contenido">
          {con && <Sesiones con={con} sesiones={sesiones} elegida={elegida} onElegir={elegir} onOcupado={marcarOcupado} bloqueado={ocupado || seleccionando || !estado.conectado} />}
          {v ? <section id="mesas-sesion" aria-label="Avance de las mesas"><Mesas v={v} /></section> : <p className="nota">Elige o crea una sesión.</p>}
        </div>
        {v && con && <Acciones key={v.sesion.id} v={v} con={con} k={k} bloqueado={ocupado || seleccionando || !estado.conectado} onOcupado={marcarOcupado} />}
      </div>
      {v && <Registro key={v.sesion.id} v={v} />}
    </div>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return <div className="esc"><div className="esc-barra"><b>Tomatera · vista de los autores</b></div><div style={{ padding: 20 }}>{children}</div></div>;
}

function BarraAutores({ v, con, conectado }: { v: Vista | null; con: Conexion | null; conectado: boolean }) {
  const ahora = usarTic(1000);
  if (!v || !con) return <div className="esc-barra"><b>Tomatera · vista de los autores</b><span className="suave">{conectado ? 'Conectado' : 'Conectando…'}</span></div>;
  const s = v.sesion;
  const personas = Object.values(v.estado.participantes);
  const restante = restanteAhora(s.restanteMs, s.ahoraServidor, s.pausada, con.desfaseMs(), ahora);
  const tiempo = s.estado !== 'en_curso' ? '' : ` · minuto ${Math.floor(minutoActual(s, restante))} · ${s.pausada ? 'en pausa' : formatoReloj(restante)}`;
  const conectados = personas.filter((p) => p.conectado).length;
  return (
    <div className="esc-barra">
      <b>Tomatera · vista de los autores</b>
      <span className="suave">Sesión {s.codigo}{s.prueba ? ` (prueba ×${s.velocidad})` : ''} · {s.estado === 'cerrada' ? 'cerrada' : s.nombreTramo}{tiempo}</span>
      <span className={`pildora${conectados < personas.length || !conectado ? ' warn' : ''}`}>
        {conectado ? `${conectados} de ${personas.length} conectados` : 'Sin conexión con el servidor'}
      </span>
    </div>
  );
}

function Sesiones({ con, sesiones, elegida, onElegir, onOcupado, bloqueado }: { con: Conexion; sesiones: ResumenSesion[]; elegida: string | null; onElegir: (id: string) => Promise<boolean>; onOcupado: (valor: boolean) => void; bloqueado: boolean }) {
  const [tipo, setTipo] = useState('real');
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const pendiente = useRef(false);
  const id = useId();
  async function crear() {
    if (bloqueado || pendiente.current) return;
    pendiente.current = true;
    onOcupado(true);
    setCreando(true);
    setError(null);
    const prueba = tipo !== 'real';
    const velocidad = prueba ? Number(tipo) : 1;
    try {
      const r = await con.emitir<{ ok: boolean; sesionId?: string; error?: string }>('crearSesion', { prueba, velocidad });
      onOcupado(false);
      if (r.ok && r.sesionId) await onElegir(r.sesionId);
      else setError(r.error ?? 'No se pudo crear la sesión');
    } catch {
      setError('El servidor no respondió');
    } finally {
      pendiente.current = false;
      setCreando(false);
      onOcupado(false);
    }
  }
  return (
    <details className="panel-desplegable sesiones-panel" open={!elegida}>
      <summary>Sesiones <span className="nota">{sesiones.length} disponibles</span></summary>
      <div className="caja">
      <div className="fila">
        <label className="etq" htmlFor={id}>Nueva sesión</label>
        <select id={id} value={tipo} disabled={bloqueado || creando} onChange={(e) => setTipo(e.target.value)} style={{ width: 'auto' }}>
          <option value="real">Real (la del aula)</option>
          <option value="1">De prueba ×1</option>
          <option value="10">De prueba ×10</option>
          <option value="60">De prueba ×60</option>
        </select>
        <button type="button" className="btn" disabled={bloqueado || creando} style={{ width: 'auto', flex: '0 0 auto', minHeight: 40, padding: '8px 14px' }} onClick={crear}>{creando ? 'Creando…' : 'Crear sesión'}</button>
        {error && <span className="error" role="alert">{error}</span>}
      </div>
      <div className="sesiones">
        {sesiones.map((s) => (
          <button key={s.id} type="button" disabled={bloqueado || creando} aria-pressed={s.id === elegida} className={`item${s.id === elegida ? ' elegido' : ''}`} onClick={() => void onElegir(s.id)}>
            <span className="id">{new Date(s.creadaEn).toLocaleString('es')} · {s.prueba ? `prueba ×${s.velocidad}` : 'real'} · {s.estado}</span>
            <span>Sesión <b className="mono">{s.codigo}</b> · {s.inscritos} inscritos</span>
          </button>
        ))}
      </div>
      </div>
    </details>
  );
}

function Mesas({ v }: { v: Vista }) {
  const e = v.estado;
  const mesas = Object.values(e.mesas).sort((a, b) => a.numero - b.numero);
  const sinMesa = Object.values(e.participantes).filter((p) => p.mesa === null);
  return (
    <>
      {sinMesa.length > 0 && (
        <p className="nota">
          {mesas.length === 0 ? `Inscritos sin mesa todavía: ${sinMesa.length}.` : `Espectadores: ${sinMesa.filter((p) => p.espectador).length}.`}
        </p>
      )}
      <div className="mgrid">
        {mesas.map((m) => <TarjetaMesa key={m.numero} m={m} e={e} lecturas={v.lecturas[m.numero]} />)}
      </div>
    </>
  );
}

function TarjetaMesa({ m, e, lecturas }: { m: Mesa; e: EstadoDeSesion; lecturas: VistaAutores['lecturas'][number] | undefined }) {
  const ids = Object.keys(m.miembros);
  const sinConexion = ids.filter((id) => !e.participantes[id]?.conectado);
  const ronda = m.rondas[m.rondas.length - 1];
  const tramo = e.tramoIndice === null ? null : e.contenido.agenda[e.tramoIndice]?.id;
  const fase = tramo === 'medicion_previa' ? 'previa' : tramo === 'medicion_posterior' ? 'posterior' : null;
  return (
    <div className={`mcard${sinConexion.length > 0 ? ' alerta' : ''}`}>
      <h3>Mesa {m.numero} <span>{ids.length} personas{m.lineaBase.congeladaEn ? ' · congelada' : ''}</span></h3>
      <div className="quienes">
        {ids.map((id) => {
          const p = e.participantes[id];
          const roles = m.miembros[id].map(nombreRol).join(' + ');
          return (
            <span key={id} className={p?.conectado ? '' : 'off'} title={`${p?.apodo ?? 'Sin apodo'} · ${id}${p?.bot ? ' · simulado' : ''}`}>
              {roles}{p?.conectado ? '' : ' sin conexión'}
            </span>
          );
        })}
      </div>
      <p className="cuentas">
        {m.necesidades.length} necesidades · {m.glosario.length} términos · {m.tarjetas.length} tarjetas · {m.divergencias.length} divergencias
      </p>
      {fase && <p className="progreso">Medición {fase}: {ids.filter((id) => Boolean(e.medicion[id]?.[fase])).length} de {ids.length} respuestas enviadas</p>}
      {e.estado === 'cerrada' && <p className="progreso">Encuesta final: {ids.filter((id) => Boolean(e.cuestionario[id])).length} de {ids.length} respuestas enviadas</p>}
      {ronda && <p className="cuentas">Ronda {ronda.numero}: {ronda.reveladaEn ? `revelada, ${Object.keys(ronda.resultados).length} de ${ronda.items.length} marcadas` : 'abierta'}</p>}
      {m.reabiertos.length > 0 && <p className="cuentas">Reabierto: {m.reabiertos.map((t) => e.contenido.agenda.find((a) => a.id === t)?.nombre ?? t).join(', ')}</p>}
      {lecturas && (
        <div className="lect">
          {(['E1', 'E2', 'E3', 'E4', 'E5'] as const).map((x) => (
            <span key={x} className={`chip ${lecturas[x].valor === 'Sí' ? 'ok' : lecturas[x].valor === 'No' ? 'mal' : 'warn'}`} title={lecturas[x].texto}>
              {x} {lecturas[x].valor}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Acciones({ v, con, k, bloqueado, onOcupado }: { v: Vista; con: Conexion; k: string; bloqueado: boolean; onOcupado: (valor: boolean) => void }) {
  const [mensaje, setMensaje] = useState<{ error?: string; listo?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const pendiente = useRef(false);
  // Igual que en la pantalla de Leandro: tras mover el tramo, los botones esperan a que llegue el tramo nuevo.
  const [esperandoDesde, setEsperandoDesde] = useState<number | null | undefined>(undefined);
  const e = v.estado;
  const s = v.sesion;
  useEffect(() => setEsperandoDesde(undefined), [s.tramoIndice]);
  async function hacer(tipo: TipoComando, datos: unknown = {}, listo = 'Hecho'): Promise<boolean> {
    if (bloqueado || pendiente.current) return false;
    pendiente.current = true;
    setEnviando(true);
    onOcupado(true);
    setMensaje({});
    try {
      const r = await con.enviar(tipo, datos);
      setMensaje(r.ok ? { listo } : { error: r.error });
      return r.ok;
    } catch {
      setMensaje({ error: 'No se pudo enviar el cambio. Inténtalo de nuevo.' });
      return false;
    } finally {
      pendiente.current = false;
      setEnviando(false);
      onOcupado(false);
    }
  }
  async function moverTramo(tipo: 'avanzarTramo' | 'retrocederTramo') {
    if (tipo === 'avanzarTramo' && s.tramoIndice === s.agenda.length - 1 && !window.confirm('¿Terminar la sesión? Después no se puede volver atrás.')) return;
    setEsperandoDesde(s.tramoIndice);
    if (!(await hacer(tipo, { desde: s.tramoIndice }))) setEsperandoDesde(undefined);
  }
  const moviendo = esperandoDesde !== undefined;
  const deshabilitado = bloqueado || enviando || moviendo;
  const mesas = Object.values(e.mesas).map((m) => m.numero).sort((a, b) => a - b);
  const enlaceSesion = `${v.enlaceLeandro}&s=${encodeURIComponent(e.id)}`;
  return (
    <aside className="lado" id="control-sesion" aria-label="Controles de la sesión">
      <h2>Sesión {s.codigo}</h2>
      <p className="nota">{s.estado === 'cerrada' ? 'Sesión terminada' : s.nombreTramo}. {s.prueba ? `Prueba ×${s.velocidad}` : 'Sesión del aula'}.</p>
      {enviando && <p className="nota" role="status">Enviando cambio…</p>}
      {mensaje.error && <p className="error" role="alert">{mensaje.error}</p>}
      {mensaje.listo && <p className="listo" role="status">{mensaje.listo}</p>}
      <fieldset className="controles-grupo" disabled={deshabilitado}>
      <h3>Conducir</h3>
      {!s.inscripcionCerrada && <><button type="button" className="btn" disabled={Object.keys(e.participantes).length < 5} onClick={() => hacer('cerrarInscripcion', {}, 'Inscripción cerrada y roles repartidos')}>Cerrar inscripción y repartir roles</button>{Object.keys(e.participantes).length < 5 && <p className="nota">Se necesitan al menos cinco participantes para formar una mesa.</p>}</>}
      {s.inscripcionCerrada && s.estado !== 'cerrada' && (
        <div className="fila">
          <button type="button" className="btn sec" disabled={!s.tramoIndice || moviendo} onClick={() => moverTramo('retrocederTramo')}>Retroceder</button>
          <button type="button" className="btn" disabled={moviendo} onClick={() => moverTramo('avanzarTramo')}>
            {s.tramoIndice === null ? 'Empezar' : s.tramoIndice === s.agenda.length - 1 ? 'Terminar la sesión' : 'Siguiente tramo'}
          </button>
        </div>
      )}
      {s.estado === 'en_curso' && (
        <div className="fila">
          <button type="button" className="btn sec" onClick={() => hacer(s.pausada ? 'reanudar' : 'pausar', {}, s.pausada ? 'Sesión reanudada' : 'Sesión pausada')}>{s.pausada ? 'Reanudar' : 'Pausar'}</button>
          {s.tramo === 'a51' && ([1, 2] as const).map((n) => (
            <button key={n} type="button" className="btn sec" disabled={Object.values(e.mesas).some((m) => m.rondas.some((r) => r.numero === n))} onClick={() => hacer('lanzarRonda', { numero: n }, `Ronda ${n} lanzada`)}>Lanzar ronda {n}</button>
          ))}
        </div>
      )}
      <label className="casilla" style={{ fontWeight: 600 }}>
        <input type="checkbox" checked={e.avanceAutomatico} disabled={s.estado === 'cerrada'} onChange={(x) => hacer('cambiarAvance', { automatico: x.target.checked })} />
        Avance automático al terminar cada tramo
      </label>
      </fieldset>

      {mesas.length > 0 && (
        <details className="panel-desplegable">
          <summary>Corregir una mesa</summary>
          <fieldset className="controles-grupo" disabled={deshabilitado}>
          <MoverPersona e={e} hacer={hacer} />
          <PorMesa
            mesas={mesas} titulo="Reabrir un tramo en una mesa" opciones={TRAMOS_REABRIBLES} boton="Reabrir"
            nombres={Object.fromEntries(s.agenda.map((t) => [t.id, t.nombre]))}
            onHacer={(mesa, tramo) => hacer('reabrirPlantilla', { mesa, tramo }, `Reabierto ${s.agenda.find((t) => t.id === tramo)?.nombre ?? tramo} en la mesa ${mesa}`)}
          />
          <PorMesa
            mesas={mesas} titulo="Repetir una ronda en una mesa" opciones={['1', '2']} boton="Repetir"
            onHacer={(mesa, numero) => hacer('repetirRonda', { mesa, numero: Number(numero) }, `Ronda ${numero} repetida en la mesa ${mesa}`)}
          />
          </fieldset>
        </details>
      )}

      <section className="materiales" id="materiales-sesion" aria-label="Materiales y resultados">
      <h3>Materiales y resultados</h3>
      <a className="btn sec" href={`/api/autores/exportar?s=${encodeURIComponent(e.id)}&k=${encodeURIComponent(k)}`} download>Exportar todo (JSON)</a>
      {s.prueba && <Simular con={con} sesionId={e.id} bloqueado={deshabilitado} onOcupado={onOcupado} />}
      <div className="caja">
        <span className="etq">Enlaces</span>
        <p className="nota">Estudiantes: <span className="mono">{v.enlaceBase}/?c={s.codigo}</span></p>
        <p className="nota">Leandro (secreto, no lo proyectes): <a href={enlaceSesion} target="_blank" rel="noreferrer">pantalla</a> · <a href={enlaceSesion.replace('/leandro?', '/leandro/entrevista?')} target="_blank" rel="noreferrer">entrevista</a></p>
        <p className="nota">
          Para imprimir: {[['cartas', 'cartas'], ['hojas', 'hojas de rol'], ['plantillas', 'plantillas'], ['medicion', 'medición'], ['cuestionario', 'cuestionario'], ['qr', 'QR'], ['carteles', 'carteles']].map(([p, n], i) => (
            <span key={p}>{i > 0 ? ' · ' : ''}<a href={`/imprimir/${p}?k=${encodeURIComponent(k)}&s=${encodeURIComponent(e.id)}`} target="_blank" rel="noreferrer">{n}</a></span>
          ))}
        </p>
      </div>
      </section>
    </aside>
  );
}

function MoverPersona({ e, hacer }: { e: EstadoDeSesion; hacer: (tipo: TipoComando, datos: unknown, listo?: string) => Promise<unknown> }) {
  const personas = Object.values(e.participantes).sort((a, b) => (a.mesa ?? 99) - (b.mesa ?? 99));
  const [id, setId] = useState('');
  const [mesa, setMesa] = useState('');
  const [roles, setRoles] = useState<Rol[]>([]);
  const idPersona = useId();
  const elegida = e.participantes[id];
  useEffect(() => {
    if (!elegida) return;
    setMesa(elegida.mesa === null ? 'espectador' : String(elegida.mesa));
    setRoles(elegida.roles);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const alternar = (r: Rol) => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const espectador = mesa === 'espectador';
  return (
    <div className="caja">
      <label className="etq" htmlFor={idPersona}>Mover a alguien de mesa o de rol</label>
      <select id={idPersona} value={id} onChange={(x) => setId(x.target.value)}>
        <option value="">Elige a una persona</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.mesa === null ? (p.espectador ? 'Espectador' : 'Sin mesa') : `Mesa ${p.mesa}`} · {p.roles.map(nombreRol).join(' + ') || 'Sin rol'} · {p.apodo ?? p.id.slice(0, 6)}{p.bot ? ' (sim.)' : ''}
          </option>
        ))}
      </select>
      {elegida && (
        <>
          <select value={mesa} onChange={(x) => setMesa(x.target.value)} aria-label="Mesa de destino">
            {Object.values(e.mesas).map((m) => <option key={m.numero} value={m.numero}>Mesa {m.numero}</option>)}
            <option value="espectador">Espectador</option>
          </select>
          {!espectador && (
            <div className="quienes" role="group" aria-label="Roles">
              {ROLES.map((r) => (
                <label key={r} className="casilla" style={{ fontWeight: 600, fontSize: 13 }}>
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => alternar(r)} />{nombreRol(r)}
                </label>
              ))}
            </div>
          )}
          <button
            type="button" className="btn" disabled={!espectador && roles.length === 0}
            onClick={() => hacer('moverParticipante', espectador
              ? { participanteId: id, mesa: null, roles: [], espectador: true }
              : { participanteId: id, mesa: Number(mesa), roles }, 'Persona movida')}
          >
            Mover
          </button>
        </>
      )}
    </div>
  );
}

function PorMesa(p: { mesas: number[]; titulo: string; opciones: string[]; nombres?: Record<string, string>; boton: string; onHacer: (mesa: number, opcion: string) => void }) {
  const [mesa, setMesa] = useState(String(p.mesas[0] ?? ''));
  const [opcion, setOpcion] = useState(p.opciones[0]);
  return (
    <div className="caja">
      <span className="etq">{p.titulo}</span>
      <div className="fila">
        <select value={mesa} onChange={(x) => setMesa(x.target.value)} aria-label="Mesa" style={{ width: 'auto' }}>
          {p.mesas.map((n) => <option key={n} value={n}>Mesa {n}</option>)}
        </select>
        <select value={opcion} onChange={(x) => setOpcion(x.target.value)} aria-label="Qué" style={{ width: 'auto' }}>
          {p.opciones.map((o) => <option key={o} value={o}>{p.nombres?.[o] ?? (/^\d$/.test(o) ? `Ronda ${o}` : o)}</option>)}
        </select>
        <button type="button" className="btn sec" style={{ width: 'auto' }} onClick={() => p.onHacer(Number(mesa), opcion)}>{p.boton}</button>
      </div>
    </div>
  );
}

function Simular({ con, sesionId, bloqueado, onOcupado }: { con: Conexion; sesionId: string; bloqueado: boolean; onOcupado: (valor: boolean) => void }) {
  const [n, setN] = useState(36);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pendiente = useRef(false);
  async function simular() {
    if (bloqueado || pendiente.current) return;
    pendiente.current = true;
    setEnviando(true);
    onOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await con.emitir<{ ok: boolean; error?: string }>('simular', { sesionId, n });
      if (r.ok) setMensaje(`Se sumaron ${n} participantes simulados`);
      else setError(r.error ?? 'No se pudo simular');
    } catch {
      setError('El servidor no respondió');
    } finally {
      pendiente.current = false;
      setEnviando(false);
      onOcupado(false);
    }
  }
  return (
    <div className="caja">
      <span className="etq">Participantes simulados</span>
      <div className="fila">
        <input type="number" min={1} max={45} value={n} disabled={bloqueado || enviando} onChange={(x) => setN(Number(x.target.value))} aria-label="Cuántos participantes simulados" style={{ width: 80 }} />
        <button type="button" className="btn" disabled={bloqueado || enviando || !Number.isInteger(n) || n < 1 || n > 45} style={{ width: 'auto' }} onClick={simular}>{enviando ? 'Simulando…' : `Simular ${n} participantes`}</button>
      </div>
      {mensaje && <p className="listo" role="status">{mensaje}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Registro({ v }: { v: Vista }) {
  const e = v.estado;
  return (
    <details className="registro-panel panel-desplegable">
      <summary>Registro en vivo <span className="nota">{v.registro.length} eventos</span></summary>
      <div className="registro" aria-label="Registro en vivo">
      {[...v.registro].reverse().map((ev) => (
        <p key={ev.seq}>
          <span className="t">{new Date(ev.en).toLocaleTimeString('es')}</span>
          {ev.mesa ? ` · Mesa ${ev.mesa}` : ''} · {quien(ev, e)} · {textoRoles(describir(ev))}
        </p>
      ))}
      </div>
    </details>
  );
}

function quien(ev: Evento, e: EstadoDeSesion): string {
  if (ev.por.tipo === 'participante') {
    const p = e.participantes[ev.por.id];
    return `${ev.por.roles.map(nombreRol).join(' + ') || 'participante'}${p?.bot ? ' (sim.)' : ''}`;
  }
  return { leandro: 'Leandro', autores: 'Autores', sistema: 'Sistema' }[ev.por.tipo] ?? ev.por.tipo;
}

// Una frase corta por evento; los datos completos quedan en la exportación.
function describir(ev: Evento): string {
  const d = ev.datos as Record<string, unknown>;
  const id = (x: unknown) => (x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : '');
  switch (ev.tipo) {
    case 'necesidad.guardada': return `guardó ${id(d.necesidad)}`;
    case 'termino.guardado': return `guardó ${id(d.termino)}`;
    case 'tarjeta.guardada': return `guardó ${id(d.tarjeta)}`;
    case 'divergencia.guardada': return `registró ${id(d.divergencia)}`;
    case 'conexion': return d.conectado ? 'se conectó' : 'se desconectó';
    case 'tramo.iniciado': return `empezó el tramo ${Number(d.indice) + 1}`;
    case 'ronda.lanzada': return `lanzó la ronda ${d.numero}`;
    case 'ronda.revelada': return `se reveló la ronda ${d.numero}`;
    case 'ronda.respondida': return `respondió la ronda ${d.numero}`;
    case 'participante.unido': return 'se unió';
    default: return ev.tipo;
  }
}

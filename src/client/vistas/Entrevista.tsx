import { useId, useMemo, useRef, useState } from 'react';
import { textoRoles } from '../../shared/roles.js';
import { MAX_TEXTO } from '../../shared/valores.js';
import type { VistaLeandro } from '../../shared/vistas.js';
import { almacenLocal, conPrefijo, crearBorradores } from '../borradores.js';
import type { Conexion } from '../conexion.js';
import { usarConexion, usarEstado } from '../usarConexion.js';

// Las notas de Leandro de la entrevista con los FR, en una pestaña que no se proyecta. Nada se graba.
export function Entrevista() {
  const q = new URLSearchParams(window.location.search);
  const k = q.get('k') ?? '';
  const con = usarConexion(k ? { tipo: 'leandro', k, sesionId: q.get('s') ?? undefined } : null);
  const estado = usarEstado(con);
  const v = estado.vista as VistaLeandro | null;
  return (
    <main className="cel">
      <div className="cuerpo">
        <a href={`/leandro?k=${encodeURIComponent(k)}${v ? `&s=${encodeURIComponent(v.sesion.id)}` : ''}`}>← Volver a la sesión</a>
        <h1 className="logo">Entrevista con los facilitadores</h1>
        <p className="nota">Espacio de notas del profesor Leandro. Esta vista se consulta sin proyectar.</p>
        {!k && <p className="error">Falta la clave en el enlace.</p>}
        {k && !v && <p className="nota">{estado.error ?? 'Conectando…'}</p>}
        {v && <p className="nota" role="status">Sesión {v.sesion.codigo} · {estado.conectado ? 'Conectado' : 'Sin conexión; reconectando…'}</p>}
        {v && !v.entrevista && <p className="nota">La entrevista se abre cuando termina la sesión. Esta pestaña se actualiza sola.</p>}
        {v?.entrevista && con && v.entrevista.preguntas.map((pregunta, i) => (
          <Nota key={`${v.sesion.id}:${i}`} con={con} conectado={estado.conectado} sesionId={v.sesion.id} numero={i + 1} pregunta={pregunta} guardada={v.entrevista!.notas.find((n) => n.pregunta === i + 1)?.texto ?? ''} />
        ))}
      </div>
    </main>
  );
}

function Nota(p: { con: Conexion; conectado: boolean; sesionId: string; numero: number; pregunta: string; guardada: string }) {
  const borradores = useMemo(() => conPrefijo(crearBorradores(almacenLocal()), `${p.sesionId}:entrevista:`), [p.sesionId]);
  const [texto, setTexto] = useState(() => borradores.leer(String(p.numero)) || p.guardada);
  const [estado, setEstado] = useState<{ error?: string; listo?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const pendiente = useRef(false);
  const id = useId();
  async function guardar() {
    if (!p.conectado || pendiente.current) return;
    pendiente.current = true;
    setEnviando(true);
    setEstado({});
    try {
      const r = await p.con.enviar('notaEntrevista', { pregunta: p.numero, texto });
      if (r.ok) borradores.borrar(String(p.numero));
      setEstado(r.ok ? { listo: 'Nota guardada' } : { error: r.error });
    } catch {
      setEstado({ error: 'No se pudo guardar la nota. El borrador sigue en este dispositivo.' });
    } finally {
      pendiente.current = false;
      setEnviando(false);
    }
  }
  return (
    <div className="papel">
      <label className="etq" htmlFor={id} style={{ color: 'var(--app-ink)', fontSize: 16 }}>{p.numero}. {textoRoles(p.pregunta)}</label>
      <textarea id={id} value={texto} disabled={enviando} onChange={(e) => { setTexto(e.target.value); borradores.guardar(String(p.numero), e.target.value); setEstado({}); }} />
      <p className="nota">El borrador se conserva en este dispositivo hasta que guardes la nota.</p>
      {texto.length > MAX_TEXTO && <span className="contador excede">{texto.length} de {MAX_TEXTO} caracteres</span>}
      <button type="button" className="btn" disabled={enviando || !p.conectado || texto.length > MAX_TEXTO} onClick={guardar}>{enviando ? 'Guardando…' : 'Guardar la nota'}</button>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.listo && <p className="listo" role="status">{estado.listo}</p>}
    </div>
  );
}

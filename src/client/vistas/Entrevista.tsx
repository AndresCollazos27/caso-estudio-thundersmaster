import { useId, useMemo, useState } from 'react';
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
        <p className="logo">Entrevista con los FR</p>
        {!k && <p className="error">Falta la clave en el enlace.</p>}
        {k && !v && <p className="nota">{estado.error ?? 'Conectando…'}</p>}
        {v && !v.entrevista && <p className="nota">La entrevista se abre cuando termina la sesión. Esta pestaña se actualiza sola.</p>}
        {v?.entrevista && con && v.entrevista.preguntas.map((pregunta, i) => (
          <Nota key={i} con={con} sesionId={v.sesion.id} numero={i + 1} pregunta={pregunta} guardada={v.entrevista!.notas.find((n) => n.pregunta === i + 1)?.texto ?? ''} />
        ))}
      </div>
    </main>
  );
}

function Nota(p: { con: Conexion; sesionId: string; numero: number; pregunta: string; guardada: string }) {
  const borradores = useMemo(() => conPrefijo(crearBorradores(almacenLocal()), `${p.sesionId}:entrevista:`), [p.sesionId]);
  const [texto, setTexto] = useState(() => borradores.leer(String(p.numero)) || p.guardada);
  const [estado, setEstado] = useState<{ error?: string; listo?: string }>({});
  const id = useId();
  async function guardar() {
    const r = await p.con.enviar('notaEntrevista', { pregunta: p.numero, texto });
    if (r.ok) borradores.borrar(String(p.numero));
    setEstado(r.ok ? { listo: 'Guardada' } : { error: r.error });
  }
  return (
    <div className="papel">
      <label className="etq" htmlFor={id} style={{ color: 'var(--app-ink)', fontSize: 16 }}>{p.numero}. {p.pregunta}</label>
      <textarea id={id} value={texto} onChange={(e) => { setTexto(e.target.value); borradores.guardar(String(p.numero), e.target.value); }} />
      {texto.length > MAX_TEXTO && <span className="contador excede">{texto.length} de {MAX_TEXTO} caracteres</span>}
      <button type="button" className="btn" disabled={texto.length > MAX_TEXTO} onClick={guardar}>Guardar la nota</button>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.listo && <p className="listo" role="status">{estado.listo}</p>}
    </div>
  );
}

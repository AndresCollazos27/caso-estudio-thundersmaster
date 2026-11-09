import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MAX_TEXTO } from '../../shared/valores.js';
import { textoRoles } from '../../shared/roles.js';
import { aplicarCambio, guardarCambios, leerCambios } from '../cambios.js';
import type { Respuesta } from '../conexion.js';
import { usarMesa } from '../contexto.js';

// Manda un comando y deja el resultado a la vista: «enviando», el error del servidor o un aviso de listo.
export function usarEnvio() {
  const pendiente = useRef(false);
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; listo: string | null }>({
    enviando: false, error: null, listo: null,
  });
  async function correr(accion: () => Promise<Respuesta>, listo = 'Guardado'): Promise<boolean> {
    if (pendiente.current) return false;
    pendiente.current = true;
    setEstado({ enviando: true, error: null, listo: null });
    try {
      const r = await accion();
      setEstado({ enviando: false, error: r.ok ? null : textoRoles(r.error), listo: r.ok ? listo : null });
      return r.ok;
    } catch {
      setEstado({ enviando: false, error: 'No se pudo guardar. Tu borrador sigue en este dispositivo; vuelve a intentarlo.', listo: null });
      return false;
    } finally {
      pendiente.current = false;
    }
  }
  return { ...estado, correr };
}

export function Mensajes({ error, listo }: { error?: string | null; listo?: string | null }) {
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {listo && <p className="listo" role="status">{listo}</p>}
    </>
  );
}

export function Opciones<T extends string>(p: {
  valores: readonly T[];
  valor?: T;
  onElegir: (v: T) => void;
  etiqueta?: string;
  marcas?: boolean;
  deshabilitado?: boolean;
  nombres?: Partial<Record<T, string>>;
}) {
  return (
    <div className={`seg${p.marcas ? ' marcas' : ''}`} role="group" aria-label={p.etiqueta}>
      {p.valores.map((x) => (
        <button key={x} type="button" aria-pressed={p.valor === x} disabled={p.deshabilitado} onClick={() => p.onElegir(x)}>
          {p.nombres?.[x] ?? x}
        </button>
      ))}
    </div>
  );
}

// Un formulario que recuerda lo que se vio al abrirlo y guarda como borrador solo lo que la persona cambió.
// `cambios` es lo que hay que enviar: así dos personas pueden editar campos distintos del mismo ítem.
export function usarFormulario<T extends object>(clave: string, inicial: T) {
  const { borradores } = usarMesa();
  const [inicio, setInicio] = useState<T>(inicial);
  const [cambios, setCambios] = useState<Partial<T>>(() => leerCambios<T>(borradores.leer(clave)));
  const datos = { ...inicio, ...cambios } as T;
  function poner<K extends keyof T>(k: K, valor: T[K]) {
    setCambios((c) => {
      const nuevo = aplicarCambio(c, inicio, k, valor);
      if (Object.keys(nuevo).length > 0) borradores.guardar(clave, guardarCambios(nuevo));
      else borradores.borrar(clave);
      return nuevo;
    });
  }
  // Después de guardar (o al cancelar): sin borrador, y con lo guardado como nuevo punto de partida si se indica.
  function limpiar(siguiente: T = inicial) {
    borradores.borrar(clave);
    setInicio(siguiente);
    setCambios({});
  }
  return { datos, cambios, hayCambios: Object.keys(cambios).length > 0, poner, limpiar };
}

export function AreaTexto(p: { etiqueta: string; valor: string; onCambio: (t: string) => void; corto?: boolean; ayuda?: string }) {
  const id = useId();
  const excede = p.valor.length > MAX_TEXTO;
  return (
    <div className="campo">
      <label className="etq" htmlFor={id}>{p.etiqueta}</label>
      {p.corto
        ? <input id={id} type="text" value={p.valor} onChange={(e) => p.onCambio(e.target.value)} />
        : <textarea id={id} value={p.valor} onChange={(e) => p.onCambio(e.target.value)} />}
      {(excede || p.valor.length > MAX_TEXTO * 0.8) && (
        <span className={`contador${excede ? ' excede' : ''}`}>{p.valor.length} de {MAX_TEXTO} caracteres</span>
      )}
      {p.ayuda && <p className="nota">{p.ayuda}</p>}
    </div>
  );
}

export const excedeTexto = (...textos: string[]) => textos.some((t) => t.length > MAX_TEXTO);

export function Capa(p: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const d = dialogo.current;
    d?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
      anterior?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={dialogo} className="capa" aria-labelledby={tituloId} onCancel={(e) => { e.preventDefault(); p.onCerrar(); }}>
      <div className="capa-cab">
        <h2 id={tituloId}>{p.titulo}</h2>
        <button type="button" className="enlace" onClick={p.onCerrar}>Volver a la actividad</button>
      </div>
      {p.children}
    </dialog>
  );
}

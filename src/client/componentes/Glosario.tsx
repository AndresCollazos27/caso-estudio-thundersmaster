import { useId, useState } from 'react';
import type { Termino } from '../../shared/tipos.js';
import { ESTADO_TERMINO, SI_NO, type EstadoTermino, type SiNo } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo } from '../textos.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

// Plantilla 03. Todos la leen; AN, QA y RT la editan de A5.1 a A5.3.
export function Glosario() {
  const { v, m } = usarMesa();
  const editable = puedo(v, 'guardarTermino');
  const [editando, setEditando] = useState<string | null>(null);
  const [consulta, setConsulta] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const idBuscar = useId();
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const consultaNormalizada = normalizar(consulta.trim());
  const terminos = m.glosario.filter((t) => normalizar(`${t.termino} ${t.definicion} ${t.ejemplo}`).includes(consultaNormalizada));
  if (editando && editable) {
    const termino = m.glosario.find((t) => t.id === editando) ?? null;
    return <FormTermino key={editando} termino={termino} onListo={(aviso, guardado) => {
      setEditando(null);
      setMensaje(aviso ?? null);
      if (guardado) setConsulta('');
    }} />;
  }
  return (
    <div className="lista">
      <div className="glosario-cabecera">
        <p className="glosario-resumen">{m.glosario.length} {m.glosario.length === 1 ? 'palabra en el glosario' : 'palabras en el glosario'}</p>
        {editable
          ? <button type="button" className="btn" onClick={() => { setMensaje(null); setEditando('nuevo'); }}>Agregar palabra</button>
          : <p className="nota">Solo lectura. Las palabras se agregan y se corrigen desde la apertura del encuentro 1 hasta el cierre.</p>}
      </div>
      <Mensajes listo={mensaje} />
      <div className="campo">
        <label className="etq" htmlFor={idBuscar}>Buscar una palabra o su significado</label>
        <input id={idBuscar} type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} autoComplete="off" />
        {consulta && <p className="nota" role="status">{terminos.length} {terminos.length === 1 ? 'resultado' : 'resultados'}</p>}
      </div>
      {terminos.length === 0 && <p className="nota">{consulta ? 'No encontramos palabras con esa búsqueda. Prueba con otro término.' : 'Todavía no hay palabras en el glosario.'}</p>}
      {terminos.map((t) => {
        const cuerpo = (
          <>
            <span className="id">{t.id} · {t.estado}{t.critico === 'Sí' ? ' · crítico' : ''}</span>
            <b>{t.termino}</b>
            {t.definicion && <span>{t.definicion}</span>}
            {t.ejemplo && <span className="nota">Ejemplo: {t.ejemplo}</span>}
          </>
        );
        return editable
          ? <button key={t.id} type="button" className="item" onClick={() => { setMensaje(null); setEditando(t.id); }} aria-label={`Editar ${t.termino}`}>{cuerpo}</button>
          : <div key={t.id} className="item">{cuerpo}</div>;
      })}
    </div>
  );
}

function FormTermino({ termino, onListo }: { termino: Termino | null; onListo: (mensaje?: string, guardado?: boolean) => void }) {
  const { enviar } = usarMesa();
  const envio = usarEnvio();
  const inicial = {
    termino: termino?.termino ?? '', definicion: termino?.definicion ?? '', ejemplo: termino?.ejemplo ?? '',
    critico: (termino?.critico ?? 'No') as SiNo, estado: (termino?.estado ?? 'Tentativo') as EstadoTermino,
    responsable: termino?.responsable ?? '',
  };
  const f = usarFormulario(`termino:${termino?.id ?? 'nuevo'}`, inicial);
  const d = f.datos;
  async function guardar() {
    // Al editar se envía solo lo que cambió, para no pisar lo que otra persona guardó en otro campo.
    const datos = termino ? { id: termino.id, ...f.cambios } : { ...d };
    if (datos.termino !== undefined) datos.termino = datos.termino.trim();
    const ok = await envio.correr(() => enviar('guardarTermino', datos));
    if (ok) {
      f.limpiar();
      onListo(`La palabra «${d.termino.trim()}» quedó guardada para toda la mesa.`, true);
    }
  }
  return (
    <fieldset disabled={envio.enviando} className="papel formulario-bloqueable">
      <h2>{termino ? `Editar ${termino.termino}` : 'Agregar una palabra'}</h2>
      <p className="nota">Escribe el significado que acuerde la mesa. Puedes volver al glosario y continuar tu borrador después.</p>
      <AreaTexto etiqueta="Término" corto valor={d.termino} onCambio={(t) => f.poner('termino', t)} />
      <AreaTexto etiqueta="Qué significa en este proyecto" valor={d.definicion} onCambio={(t) => f.poner('definicion', t)} />
      <AreaTexto etiqueta="Ejemplo" valor={d.ejemplo} onCambio={(t) => f.poner('ejemplo', t)} />
      <div className="campo"><span className="etq">¿Es crítico?</span><Opciones valores={SI_NO} valor={d.critico} onElegir={(x) => f.poner('critico', x)} /></div>
      <div className="campo"><span className="etq">Estado</span><Opciones valores={ESTADO_TERMINO} valor={d.estado} onElegir={(x) => f.poner('estado', x)} /></div>
      <AreaTexto etiqueta="Responsable" corto valor={d.responsable} onCambio={(t) => f.poner('responsable', t)} />
      <div className="fila">
        <button type="button" className="btn sec" disabled={envio.enviando} onClick={() => onListo(f.hayCambios ? `Conservamos tu borrador en este dispositivo. ${termino ? 'Abre la palabra' : 'Pulsa Agregar palabra'} para continuar.` : undefined)}>Volver al glosario</button>
        <button type="button" className="btn" disabled={envio.enviando || !d.termino.trim() || (termino !== null && !f.hayCambios) || excedeTexto(...Object.values(d))} onClick={guardar}>{envio.enviando ? 'Guardando…' : 'Guardar palabra'}</button>
      </div>
      {f.hayCambios && <button type="button" className="enlace" disabled={envio.enviando} onClick={() => { f.limpiar(); onListo('Se descartaron los cambios de este borrador.'); }}>Descartar cambios</button>}
      <Mensajes error={envio.error} />
    </fieldset>
  );
}

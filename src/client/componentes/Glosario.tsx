import { useState } from 'react';
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
  if (editando) {
    const termino = m.glosario.find((t) => t.id === editando) ?? null;
    return <FormTermino key={editando} termino={termino} onListo={() => setEditando(null)} />;
  }
  return (
    <div className="lista">
      {m.glosario.map((t) => {
        const cuerpo = (
          <>
            <span className="id">{t.id} · {t.estado}{t.critico === 'Sí' ? ' · crítico' : ''}</span>
            <b>{t.termino}</b>
            {t.definicion && <span>{t.definicion}</span>}
            {t.ejemplo && <span className="nota">Ejemplo: {t.ejemplo}</span>}
          </>
        );
        return editable
          ? <button key={t.id} type="button" className="item" onClick={() => setEditando(t.id)}>{cuerpo}</button>
          : <div key={t.id} className="item">{cuerpo}</div>;
      })}
      {editable && <button type="button" className="btn sec" onClick={() => setEditando('nuevo')}>Agregar un término</button>}
    </div>
  );
}

function FormTermino({ termino, onListo }: { termino: Termino | null; onListo: () => void }) {
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
      onListo();
    }
  }
  return (
    <div className="papel">
      <h2>{termino ? `Editar ${termino.id}` : 'Nuevo término'}</h2>
      <AreaTexto etiqueta="Término" corto valor={d.termino} onCambio={(t) => f.poner('termino', t)} />
      <AreaTexto etiqueta="Qué significa en este proyecto" valor={d.definicion} onCambio={(t) => f.poner('definicion', t)} />
      <AreaTexto etiqueta="Ejemplo" valor={d.ejemplo} onCambio={(t) => f.poner('ejemplo', t)} />
      <div className="campo"><span className="etq">¿Es crítico?</span><Opciones valores={SI_NO} valor={d.critico} onElegir={(x) => f.poner('critico', x)} /></div>
      <div className="campo"><span className="etq">Estado</span><Opciones valores={ESTADO_TERMINO} valor={d.estado} onElegir={(x) => f.poner('estado', x)} /></div>
      <AreaTexto etiqueta="Responsable" corto valor={d.responsable} onCambio={(t) => f.poner('responsable', t)} />
      <div className="fila">
        <button type="button" className="btn sec" onClick={() => { f.limpiar(); onListo(); }}>Volver</button>
        <button type="button" className="btn" disabled={envio.enviando || !d.termino.trim() || (termino !== null && !f.hayCambios) || excedeTexto(...Object.values(d))} onClick={guardar}>Guardar</button>
      </div>
      <Mensajes error={envio.error} />
    </div>
  );
}

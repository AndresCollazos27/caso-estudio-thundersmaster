import { useId, useState } from 'react';
import type { Tarjeta } from '../../shared/tipos.js';
import { PRIORIDAD, SI_NO, TIPO_REQUISITO, type Prioridad, type SiNo, type TipoRequisito } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo } from '../textos.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

// Plantilla 05. En A5.2 la escriben AN, QA y FR, sin el cliente; desde A5.3 todos la leen.
export function Tarjetas() {
  const { v, m } = usarMesa();
  const editable = puedo(v, 'guardarTarjeta');
  const [editando, setEditando] = useState<string | null>(null);
  const actual = editando ? m.tarjetas.find((t) => t.id === editando) ?? null : null;
  return (
    <>
      {editable && <FormTarjeta key={editando ?? 'nueva'} tarjeta={actual} onListo={() => setEditando(null)} />}
      <div className="lista" aria-label="Tarjetas">
        <h3 className="paso">Tarjetas (05)</h3>
        {m.tarjetas.length === 0 && <p className="nota">Todavía no hay tarjetas.</p>}
        {m.tarjetas.map((t) => {
          const cuerpo = <TarjetaLeida t={t} />;
          return editable
            ? <button key={t.id} type="button" className={`req${editando === t.id ? ' elegido' : ''}`} style={{ textAlign: 'left', border: 0 }} onClick={() => setEditando(t.id)}>{cuerpo}</button>
            : <div key={t.id} className="req">{cuerpo}</div>;
        })}
      </div>
    </>
  );
}

export function TarjetaLeida({ t }: { t: Tarjeta }) {
  return (
    <>
      <span className="id">{t.id} · de {t.necesidadId} · {t.tipo}{t.critico === 'Sí' ? ' · crítica' : ''}{t.prioridad ? ` · ${t.prioridad}` : ''}</span>
      <p>{t.enunciado}</p>
      {t.criterioEjemplo && <p className="ej">{t.criterioEjemplo}</p>}
      {t.restriccion && <p className="nota">Restricción: {t.restriccion}</p>}
    </>
  );
}

function FormTarjeta({ tarjeta, onListo }: { tarjeta: Tarjeta | null; onListo: () => void }) {
  const { m, enviar } = usarMesa();
  const envio = usarEnvio();
  const idNecesidad = useId();
  const vacio = {
    necesidadId: tarjeta?.necesidadId ?? '', tipo: (tarjeta?.tipo ?? 'Funcional') as TipoRequisito, enunciado: tarjeta?.enunciado ?? '',
    critico: tarjeta?.critico as SiNo | undefined, criterioEjemplo: tarjeta?.criterioEjemplo ?? '',
    prioridad: tarjeta?.prioridad as Prioridad | undefined, restriccion: tarjeta?.restriccion ?? '',
  };
  const f = usarFormulario(`tarjeta:${tarjeta?.id ?? 'nueva'}`, vacio);
  const d = f.datos;
  const siguiente = `R-${String(m.tarjetas.length + 1).padStart(2, '0')}`;
  async function guardar() {
    // Al editar se envía solo lo que cambió: el AN corrige el enunciado y el QA agrega el criterio sin pisarse.
    const { critico, prioridad, ...resto } = tarjeta ? f.cambios : d;
    const datos = { ...(tarjeta ? { id: tarjeta.id } : {}), ...resto, ...(critico ? { critico } : {}), ...(prioridad ? { prioridad } : {}) };
    if (datos.enunciado !== undefined) datos.enunciado = datos.enunciado.trim();
    if (await envio.correr(() => enviar('guardarTarjeta', datos), `Guardada ${tarjeta?.id ?? siguiente}`)) {
      f.limpiar();
      onListo();
    }
  }
  return (
    <div className="papel">
      <h2>{tarjeta ? `Editar ${tarjeta.id}` : 'Nueva tarjeta'}</h2>
      <div className="campo">
        <label className="etq" htmlFor={idNecesidad}>Necesidad de origen (04)</label>
        <select id={idNecesidad} value={d.necesidadId} onChange={(e) => f.poner('necesidadId', e.target.value)}>
          <option value="">Elige una necesidad</option>
          {m.necesidades.map((n) => <option key={n.id} value={n.id}>{n.id} · {n.necesidad.slice(0, 60)}</option>)}
        </select>
      </div>
      <div className="campo"><span className="etq">Tipo</span><Opciones etiqueta="Tipo" valores={TIPO_REQUISITO} valor={d.tipo} onElegir={(x) => f.poner('tipo', x)} /></div>
      <AreaTexto etiqueta="Enunciado del requisito" valor={d.enunciado} onCambio={(t) => f.poner('enunciado', t)} ayuda="Por ejemplo: «Como clienta, quiero… para…»." />
      <div className="campo"><span className="etq">¿Crítico?</span><Opciones etiqueta="¿Crítico?" valores={SI_NO} valor={d.critico} onElegir={(x) => f.poner('critico', x)} /></div>
      <AreaTexto
        etiqueta="Criterio de aceptación y ejemplo" valor={d.criterioEjemplo} onCambio={(t) => f.poner('criterioEjemplo', t)}
        ayuda="Un criterio que se pueda observar. En los críticos, un ejemplo «¿qué pasa si…?» con un caso límite."
      />
      <div className="campo"><span className="etq">Prioridad</span><Opciones etiqueta="Prioridad" valores={PRIORIDAD} valor={d.prioridad} onElegir={(x) => f.poner('prioridad', x)} /></div>
      {d.tipo === 'Restricción' && <AreaTexto etiqueta="Restricción: ¿negociable? y dueño" corto valor={d.restriccion} onCambio={(t) => f.poner('restriccion', t)} />}
      <div className="fila">
        {tarjeta && <button type="button" className="btn sec" onClick={() => { f.limpiar(); onListo(); }}>Cancelar</button>}
        <button type="button" className="btn" disabled={envio.enviando || !d.necesidadId || !d.enunciado.trim() || (tarjeta !== null && !f.hayCambios) || excedeTexto(d.enunciado, d.criterioEjemplo, d.restriccion)} onClick={guardar}>
          Guardar {tarjeta?.id ?? siguiente}
        </button>
      </div>
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

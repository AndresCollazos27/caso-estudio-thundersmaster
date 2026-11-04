import { useState } from 'react';
import type { Necesidad } from '../../shared/tipos.js';
import { ESTADO_NECESIDAD, PRIORIDAD, type EstadoNecesidad, type Prioridad } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo, tiene } from '../textos.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

// Quienes aportan necesidades según el mapa (02): el cliente y la ficha técnica, no el equipo de Nodo Sur.
const ROLES_FUENTE = new Set(['PO', 'SD', 'Fuente no humana']);

// Plantilla 04. El AN registra cada necesidad mientras conversa; los demás ven la lista.
export function Necesidades() {
  const { v, m } = usarMesa();
  const editable = puedo(v, 'guardarNecesidad') && tiene(v, 'AN');
  const [editando, setEditando] = useState<string | null>(null);
  const actual = editando ? m.necesidades.find((n) => n.id === editando) ?? null : null;
  return (
    <>
      {editable && <FormNecesidad key={editando ?? 'nueva'} necesidad={actual} onListo={() => setEditando(null)} />}
      <div className="lista" aria-label="Necesidades registradas">
        <h3 className="paso">Necesidades registradas (04)</h3>
        {m.necesidades.length === 0 && <p className="nota">Todavía no hay necesidades.</p>}
        {[...m.necesidades].reverse().map((n) => {
          const cuerpo = (
            <>
              <span className="id">{n.id} · {corto(n.fuente)}{n.prioridad ? ` · ${n.prioridad}` : ''}{n.estado !== 'Nueva' ? ` · ${n.estado}` : ''}</span>
              <span>{n.necesidad}</span>
              {n.supuestos && <span className="nota">Supone: {n.supuestos}</span>}
            </>
          );
          return editable
            ? <button key={n.id} type="button" className={`item${editando === n.id ? ' elegido' : ''}`} onClick={() => setEditando(n.id)}>{cuerpo}</button>
            : <div key={n.id} className="item">{cuerpo}</div>;
        })}
      </div>
    </>
  );
}

// «Lucía Ferrer, dueña» → «Lucía».
const corto = (fuente: string) => fuente.split(/[ ,]/)[0] || fuente;

function FormNecesidad({ necesidad, onListo }: { necesidad: Necesidad | null; onListo: () => void }) {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const fuentes = (v.contexto?.mapa ?? []).filter((a) => ROLES_FUENTE.has(a.rol)).map((a) => a.actor);
  const vacio = {
    necesidad: necesidad?.necesidad ?? '', fuente: necesidad?.fuente ?? '', contextoValor: necesidad?.contextoValor ?? '',
    supuestos: necesidad?.supuestos ?? '', prioridad: necesidad?.prioridad as Prioridad | undefined,
    estado: (necesidad?.estado ?? 'Nueva') as EstadoNecesidad,
  };
  const f = usarFormulario(`necesidad:${necesidad?.id ?? 'nueva'}`, vacio);
  const d = f.datos;
  const siguiente = `N-${String(m.necesidades.length + 1).padStart(2, '0')}`;
  async function guardar() {
    // Al editar se envía solo lo que cambió, para no pisar lo que otra persona guardó en otro campo.
    const { prioridad, ...resto } = necesidad ? f.cambios : d;
    const datos = { ...(necesidad ? { id: necesidad.id } : {}), ...resto, ...(prioridad ? { prioridad } : {}) };
    if (datos.necesidad !== undefined) datos.necesidad = datos.necesidad.trim();
    if (await envio.correr(() => enviar('guardarNecesidad', datos), `Guardada ${necesidad?.id ?? siguiente}`)) {
      f.limpiar();
      onListo();
    }
  }
  return (
    <div className="papel">
      <h2>{necesidad ? `Editar ${necesidad.id}` : 'Nueva necesidad'}</h2>
      <AreaTexto etiqueta="Necesidad" valor={d.necesidad} onCambio={(t) => f.poner('necesidad', t)} ayuda="Qué necesita y para qué, en palabras de quien lo dice." />
      <div className="campo">
        <span className="etq">Fuente</span>
        <Opciones etiqueta="Fuente" valores={fuentes} valor={d.fuente} onElegir={(x) => f.poner('fuente', x)} nombres={Object.fromEntries(fuentes.map((x) => [x, corto(x)]))} />
      </div>
      <AreaTexto etiqueta="Supuestos" valor={d.supuestos} onCambio={(t) => f.poner('supuestos', t)} ayuda="Lo que se da por hecho y conviene verificar." />
      <AreaTexto etiqueta="Contexto y valor (opcional)" valor={d.contextoValor} onCambio={(t) => f.poner('contextoValor', t)} />
      <div className="campo"><span className="etq">Prioridad</span><Opciones etiqueta="Prioridad" valores={PRIORIDAD} valor={d.prioridad} onElegir={(x) => f.poner('prioridad', x)} /></div>
      {necesidad && <div className="campo"><span className="etq">Estado</span><Opciones etiqueta="Estado" valores={ESTADO_NECESIDAD} valor={d.estado} onElegir={(x) => f.poner('estado', x)} /></div>}
      <div className="fila">
        {necesidad && <button type="button" className="btn sec" onClick={() => { f.limpiar(); onListo(); }}>Cancelar</button>}
        <button type="button" className="btn" disabled={envio.enviando || !d.necesidad.trim() || !d.fuente || (necesidad !== null && !f.hayCambios) || excedeTexto(d.necesidad, d.supuestos, d.contextoValor)} onClick={guardar}>
          Guardar {necesidad?.id ?? siguiente}
        </button>
      </div>
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

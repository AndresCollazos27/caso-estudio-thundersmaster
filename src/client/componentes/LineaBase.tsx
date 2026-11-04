import { useId } from 'react';
import { tarjetasCriticas } from '../../shared/lecturas.js';
import type { Evidencia } from '../../shared/tipos.js';
import { SI_NO_PEND } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { sinRespaldo } from '../evidencias.js';
import { puedo, tiene } from '../textos.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';
import { TarjetaLeida } from './Tarjetas.js';

// Nombres de la hoja 07 del libro de la versión final.
const EVIDENCIAS: Record<Evidencia, string> = {
  E1: 'E1 · Problema compartido',
  E2: 'E2 · Vocabulario compartido',
  E3: 'E3 · Críticos interpretados igual',
  E4: 'E4 · Divergencias explícitas',
  E5: 'E5 · Entendimiento transferible',
};

// A6: el RT congela la línea base; todos la ven; el FR marca E1 a E5 frente a las lecturas automáticas.
export function LineaBase() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const lb = m.lineaBase;
  const tarjetas = lb.instantanea?.tarjetas ?? m.tarjetas;
  const hora = lb.congeladaEn ? new Date(lb.congeladaEn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <>
      {tiene(v, 'RT') && !lb.congeladaEn && puedo(v, 'congelarLineaBase') && (
        <div className="papel">
          <p>Al congelarla, las tarjetas y el glosario de tu mesa quedan como línea base, y otra mesa la lee para el traspaso.</p>
          <button type="button" className="btn" disabled={envio.enviando} onClick={() => envio.correr(() => enviar('congelarLineaBase', {}), 'Congelada')}>Congelar la línea base</button>
          <Mensajes error={envio.error} listo={envio.listo} />
        </div>
      )}
      {tiene(v, 'FR') && v.lecturas && <Evidencias />}
      <div className="papel">
        <h2>Línea base de la mesa {m.numero}</h2>
        <p className="nota">{hora ? `Congelada a las ${hora}.` : 'Todavía sin congelar.'} Críticas: {tarjetasCriticas(tarjetas).length}.</p>
        {tarjetas.map((t) => <div key={t.id} className="req"><TarjetaLeida t={t} /></div>)}
      </div>
      {tiene(v, 'RT') && <Acciones />}
    </>
  );
}

function Evidencias() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const lecturas = v.lecturas!;
  const editable = puedo(v, 'marcarEvidencia');
  return (
    <div className="papel">
      <h2>Evidencias del ciclo</h2>
      <p className="nota">{lecturas.ciclo}</p>
      {(Object.keys(EVIDENCIAS) as Evidencia[]).map((e) => {
        const marca = m.lineaBase.evidencias[e];
        const naranja = sinRespaldo(lecturas[e], marca?.resultado);
        return (
          <div key={e} className="campo" style={naranja ? { boxShadow: '0 0 0 2px var(--app-warn)', borderRadius: 10, padding: 8 } : undefined}>
            <span className="etq">{EVIDENCIAS[e]}</span>
            <p className="nota">Lectura automática: {lecturas[e].texto}</p>
            <Opciones
              etiqueta={EVIDENCIAS[e]} valores={SI_NO_PEND} valor={marca?.resultado} deshabilitado={!editable}
              onElegir={(resultado) => envio.correr(() => enviar('marcarEvidencia', { evidencia: e, resultado, nota: marca?.nota ?? '' }), 'Marcada')}
            />
            {naranja && <p className="aviso">Marcaste «Sí», pero la lectura no lo respalda. Revísala con tu mesa.</p>}
          </div>
        );
      })}
      <Mensajes error={envio.error} />
    </div>
  );
}

// Lo que queda pendiente, con responsable y fecha (hoja 07, «Otras acciones»).
function Acciones() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const idOrigen = useId();
  const f = usarFormulario('accion:nueva', { origen: '', accion: '', responsable: '', fecha: '' });
  const d = f.datos;
  const editable = puedo(v, 'guardarAccion');
  const pendientes = m.divergencias.filter((x) => x.estado !== 'Resuelta y confirmada');
  async function guardar() {
    if (await envio.correr(() => enviar('guardarAccion', { ...d, accion: d.accion.trim() }), 'Acción guardada')) f.limpiar();
  }
  return (
    <div className="papel">
      <h2>Acciones pendientes</h2>
      <p className="nota">Divergencias abiertas en 06: {pendientes.length}.</p>
      {m.acciones.map((a, i) => (
        <div key={i} className="item">
          <span className="id">{a.origen || 'Sin origen'} · {a.responsable || 'sin responsable'} · {a.fecha || 'sin fecha'}</span>
          <span>{a.accion}</span>
        </div>
      ))}
      {editable && (
        <>
          <div className="campo">
            <label className="etq" htmlFor={idOrigen}>Origen</label>
            <select id={idOrigen} value={d.origen} onChange={(e) => f.poner('origen', e.target.value)}>
              <option value="">Elige una divergencia</option>
              {pendientes.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.descripcion.slice(0, 50)}</option>)}
            </select>
          </div>
          <AreaTexto etiqueta="Acción" valor={d.accion} onCambio={(t) => f.poner('accion', t)} />
          <AreaTexto etiqueta="Responsable" corto valor={d.responsable} onCambio={(t) => f.poner('responsable', t)} />
          <AreaTexto etiqueta="Fecha" corto valor={d.fecha} onCambio={(t) => f.poner('fecha', t)} />
          <button type="button" className="btn" disabled={envio.enviando || !d.accion.trim() || excedeTexto(d.accion, d.responsable, d.fecha)} onClick={guardar}>Guardar la acción</button>
          <Mensajes error={envio.error} listo={envio.listo} />
        </>
      )}
    </div>
  );
}

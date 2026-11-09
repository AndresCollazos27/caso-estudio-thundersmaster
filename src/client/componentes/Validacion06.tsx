import { useId, useState } from 'react';
import type { Divergencia } from '../../shared/tipos.js';
import { CONFORMIDAD, DETECTADA_EN, ESTADO_DIVERGENCIA, type Conformidad, type DetectadaEn, type EstadoDivergencia } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo } from '../textos.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

// Plantilla 06: las divergencias del ciclo, desde que aparecen. RT y FR las completan; los demás las leen.
export function Divergencias06() {
  const { v, m } = usarMesa();
  const editable = puedo(v, 'guardarDivergencia');
  const [editando, setEditando] = useState<string | null>(null);
  if (editando) {
    const d = m.divergencias.find((x) => x.id === editando) ?? null;
    return <FormDivergencia key={editando} divergencia={d} onListo={() => setEditando(null)} />;
  }
  return (
    <div className="lista" aria-label="Divergencias">
      <h3 className="paso">Divergencias (06)</h3>
      {m.divergencias.length === 0 && <p className="nota">Todavía no hay divergencias registradas.</p>}
      {m.divergencias.map((d) => {
        const cuerpo = (
          <>
            <span className="id">{d.id} · {d.detectadaEn}{d.afectaA ? ` · ${d.afectaA}` : ''}</span>
            <span>{d.descripcion || 'Sin describir todavía'}</span>
            {d.resolucion && <span className="nota">Resolución: {d.resolucion}</span>}
            <span><span className={`chip ${d.estado === 'Resuelta y confirmada' ? 'ok' : 'warn'}`}>{d.estado ?? 'Sin estado'}</span></span>
          </>
        );
        return editable
          ? <button key={d.id} type="button" className="item" onClick={() => setEditando(d.id)}>{cuerpo}</button>
          : <div key={d.id} className="item">{cuerpo}</div>;
      })}
      {editable && <button type="button" className="btn sec" onClick={() => setEditando('nueva')}>Registrar otra divergencia</button>}
    </div>
  );
}

function FormDivergencia({ divergencia, onListo }: { divergencia: Divergencia | null; onListo: () => void }) {
  const { m, enviar } = usarMesa();
  const envio = usarEnvio();
  const idDetectada = useId();
  const idAfecta = useId();
  const vacio = {
    detectadaEn: (divergencia?.detectadaEn ?? 'Otra') as DetectadaEn, afectaA: divergencia?.afectaA ?? '',
    descripcion: divergencia?.descripcion ?? '', resolucion: divergencia?.resolucion ?? '',
    estado: divergencia?.estado as EstadoDivergencia | undefined, responsable: divergencia?.responsable ?? '', fechaLimite: divergencia?.fechaLimite ?? '',
  };
  const f = usarFormulario(`divergencia:${divergencia?.id ?? 'nueva'}`, vacio);
  const d = f.datos;
  async function guardar() {
    // Al completar una divergencia se envía solo lo que cambió: RT y FR pueden trabajar en la misma a la vez.
    const { estado, ...resto } = divergencia ? f.cambios : d;
    const datos = { ...(divergencia ? { id: divergencia.id } : {}), ...resto, ...(estado ? { estado } : {}) };
    if (datos.descripcion !== undefined) datos.descripcion = datos.descripcion.trim();
    if (await envio.correr(() => enviar('guardarDivergencia', datos))) {
      f.limpiar();
      onListo();
    }
  }
  return (
    <div className="papel">
      <h2>{divergencia ? `Completar ${divergencia.id}` : 'Nueva divergencia'}</h2>
      <div className="campo">
        <label className="etq" htmlFor={idDetectada}>Detectada en</label>
        <select id={idDetectada} value={d.detectadaEn} onChange={(e) => f.poner('detectadaEn', e.target.value as DetectadaEn)}>
          {DETECTADA_EN.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="campo">
        <label className="etq" htmlFor={idAfecta}>Afecta a (R-xx o T-xx)</label>
        <select id={idAfecta} value={d.afectaA} onChange={(e) => f.poner('afectaA', e.target.value)}>
          <option value="">Ninguno (p. ej., el problema en A4)</option>
          {m.tarjetas.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.enunciado.slice(0, 50)}</option>)}
          {m.glosario.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.termino}</option>)}
        </select>
      </div>
      <AreaTexto etiqueta="Divergencia: quién entiende qué" valor={d.descripcion} onCambio={(t) => f.poner('descripcion', t)} />
      <AreaTexto etiqueta="Resolución acordada y justificación" valor={d.resolucion} onCambio={(t) => f.poner('resolucion', t)} ayuda="O la acción pendiente." />
      <div className="campo"><span className="etq">Estado</span><Opciones etiqueta="Estado" valores={ESTADO_DIVERGENCIA} valor={d.estado} onElegir={(x) => f.poner('estado', x)} /></div>
      {d.estado !== 'Resuelta y confirmada' && (
        <>
          <AreaTexto etiqueta="Responsable" corto valor={d.responsable} onCambio={(t) => f.poner('responsable', t)} />
          <AreaTexto etiqueta="Fecha límite" corto valor={d.fechaLimite} onCambio={(t) => f.poner('fechaLimite', t)} />
        </>
      )}
      <div className="fila">
        <button type="button" className="btn sec" onClick={onListo}>Volver</button>
        {f.hayCambios && <button type="button" className="enlace" onClick={() => { f.limpiar(); onListo(); }}>Descartar cambios</button>}
        <button type="button" className="btn" disabled={envio.enviando || !d.descripcion.trim() || (divergencia !== null && !f.hayCambios) || excedeTexto(...Object.values(d).map(String))} onClick={guardar}>Guardar</button>
      </div>
      <Mensajes error={envio.error} />
    </div>
  );
}

// El encabezado de 06: el encuentro 2, que registra el RT.
export function Validacion06() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const f = usarFormulario('validacion06', {
    conjunto: m.validacion06.conjunto, fechaParticipantes: m.validacion06.fechaParticipantes, tecnica: m.validacion06.tecnica,
    conformidad: m.validacion06.conformidad as Conformidad | undefined, constancia: m.validacion06.constancia,
  });
  if (!puedo(v, 'guardarValidacion06')) return null;
  const d = f.datos;
  const resultados = Object.values(m.i2c).map((x) => x.resultado);
  const cuenta = (r: string) => resultados.filter((x) => x === r).length;
  async function guardar() {
    const { conformidad, ...resto } = f.cambios;
    if (await envio.correr(() => enviar('guardarValidacion06', { ...resto, ...(conformidad ? { conformidad } : {}) }))) f.limpiar(d);
  }
  return (
    <div className="papel">
      <h2>06 · Encuentro 2: validación de los críticos</h2>
      <p className="nota">
        Críticos: {resultados.length} · aceptados: {cuenta('Aceptado')} · con divergencia: {cuenta('Divergencia → 06')} · por validar o pendientes: {cuenta('Por validar') + cuenta('Pendiente')}
      </p>
      <AreaTexto etiqueta="Conjunto validado (versión o rango de IDs)" corto valor={d.conjunto} onCambio={(t) => f.poner('conjunto', t)} />
      <AreaTexto etiqueta="Fecha y participantes" corto valor={d.fechaParticipantes} onCambio={(t) => f.poner('fechaParticipantes', t)} />
      <AreaTexto etiqueta="Técnica usada (ejemplo recorrido, escenario o prototipo)" corto valor={d.tecnica} onCambio={(t) => f.poner('tecnica', t)} />
      <div className="campo"><span className="etq">Conformidad</span><Opciones etiqueta="Conformidad" valores={CONFORMIDAD} valor={d.conformidad} onElegir={(x) => f.poner('conformidad', x)} /></div>
      <AreaTexto etiqueta="Constancia: quién la dio y dónde quedó" corto valor={d.constancia} onCambio={(t) => f.poner('constancia', t)} />
      <button type="button" className="btn" disabled={envio.enviando || !f.hayCambios || excedeTexto(d.conjunto, d.fechaParticipantes, d.tecnica, d.constancia)} onClick={guardar}>Guardar el encabezado</button>
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

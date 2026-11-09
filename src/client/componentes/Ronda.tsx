import { useEffect, useRef, useState } from 'react';
import type { ItemRonda } from '../../shared/tipos.js';
import { RESULTADO_I3, TECNICA_I3, type TecnicaI3 } from '../../shared/valores.js';
import type { VistaRonda } from '../../shared/vistas.js';
import { usarMesa } from '../contexto.js';
import { etiquetaRol, puedo, tiene } from '../textos.js';
import { CampoTexto } from './CampoTexto.js';
import { AreaTexto, Mensajes, Opciones, usarEnvio, usarFormulario } from './comunes.js';

// Rondas de sondeo (I3): cada quien responde en privado; al responder toda la mesa se ven las respuestas juntas.
export function Rondas() {
  const { v, m } = usarMesa();
  return (
    <>
      {[...m.rondas].reverse().map((r) => <UnaRonda key={r.numero} r={r} />)}
      {tiene(v, 'FR') && puedo(v, 'cambiarItemRonda') && <PlanRondas />}
    </>
  );
}

function UnaRonda({ r }: { r: VistaRonda }) {
  if (!r.revelada) {
    const pendiente = r.items.find((i) => !r.misRespuestas[i.id]);
    if (pendiente) return <Responder r={r} item={pendiente} />;
    return (
      <div className="papel">
        <h2>Ronda {r.numero}: ya respondiste</h2>
        <p className="nota">Cuando responda toda la mesa, aquí verán las respuestas juntas.</p>
        {r.items.map((i) => <p key={i.id} className="nota">«{i.termino}»: {r.respondieron[i.id] ?? 0} de {r.total}</p>)}
      </div>
    );
  }
  return (
    <>
      {r.items.map((i) => <Resultado key={i.id} r={r} item={i} />)}
    </>
  );
}

function Responder({ r, item }: { r: VistaRonda; item: ItemRonda }) {
  const { enviar } = usarMesa();
  const n = r.items.findIndex((i) => i.id === item.id) + 1;
  // Cuando se abre una ronda, quien estaba más abajo (en el glosario, en las necesidades) la ve sin buscarla.
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caja.current?.scrollIntoView({ block: 'start' });
  }, [r.numero]);
  return (
    <div className="papel ronda-abierta" ref={caja}>
      <p className="paso">Ronda {r.numero} · pregunta {n} de {r.items.length} · solo y en silencio</p>
      <h2>{item.pregunta}</h2>
      <CampoTexto
        key={item.id} etiqueta="Tu respuesta" clave={`ronda:${r.numero}:${item.id}`} boton="Enviar mi respuesta"
        onEnviar={(texto) => enviar('responderRonda', { numero: r.numero, itemId: item.id, texto })}
      />
    </div>
  );
}

function Resultado({ r, item }: { r: VistaRonda; item: ItemRonda }) {
  const { v, enviar } = usarMesa();
  const envio = usarEnvio();
  const resultado = r.resultados[item.id];
  const marcar = puedo(v, 'marcarRonda');
  return (
    <div className="papel">
      <p className="paso">Ronda {r.numero} · «{item.termino}» · {item.tecnica}</p>
      <p>{item.pregunta}</p>
      <div className="lista">
        {(r.respuestas?.[item.id] ?? []).map((a) => (
          <div key={a.participante} className={`ans${a.participante === v.yo.id ? ' mia' : ''}`}>
            <span className="quien">{a.roles.map((x) => etiquetaRol(v.roles, x)).join(' + ') || 'Sin rol'}{a.participante === v.yo.id ? ' · tú' : ''}</span>
            {a.texto}
          </div>
        ))}
      </div>
      {marcar && (
        <Opciones
          marcas etiqueta={`Resultado de «${item.termino}»`} valores={RESULTADO_I3} valor={resultado?.resultado} deshabilitado={envio.enviando}
          onElegir={(x) => envio.correr(() => enviar('marcarRonda', { numero: r.numero, itemId: item.id, resultado: x }), 'Marcado')}
        />
      )}
      {resultado && !marcar && <p className="nota">Resultado: <b>{resultado.resultado}</b></p>}
      {resultado?.divergenciaId && <p className="aviso">Se creó {resultado.divergenciaId}. El relator la completa en el registro 06.</p>}
      <Mensajes error={envio.error} />
    </div>
  );
}

// Antes de lanzar una ronda, el FR puede cambiar el término, la técnica o la pregunta de un ítem.
function PlanRondas() {
  const { m } = usarMesa();
  const [editando, setEditando] = useState<{ numero: 1 | 2; item: ItemRonda } | null>(null);
  const pendientes = m.planI3.filter((p) => !m.rondas.some((r) => r.numero === p.numero));
  if (pendientes.length === 0) return null;
  if (editando) return <FormItem key={`${editando.numero}:${editando.item.id}`} {...editando} onListo={() => setEditando(null)} />;
  return (
    <div className="papel">
      <h2>Rondas por lanzar</h2>
      <p className="nota">Puedes cambiar un ítem antes de que Leandro lance la ronda.</p>
      {pendientes.map((p) => p.items.map((item) => (
        <button key={`${p.numero}:${item.id}`} type="button" className="item" onClick={() => setEditando({ numero: p.numero, item })}>
          <span className="id">Ronda {p.numero} · {item.tecnica}</span>
          <b>«{item.termino}»</b>
          <span>{item.pregunta}</span>
        </button>
      )))}
    </div>
  );
}

function FormItem({ numero, item, onListo }: { numero: 1 | 2; item: ItemRonda; onListo: () => void }) {
  const { m, enviar } = usarMesa();
  const envio = usarEnvio();
  const f = usarFormulario(`item:${numero}:${item.id}`, { termino: item.termino, tecnica: item.tecnica as TecnicaI3, pregunta: item.pregunta });
  const d = f.datos;
  async function guardar() {
    if (await envio.correr(() => enviar('cambiarItemRonda', { numero, itemId: item.id, termino: d.termino, tecnica: d.tecnica, pregunta: d.pregunta.trim() }))) {
      f.limpiar();
      onListo();
    }
  }
  return (
    <div className="papel">
      <h2>Ítem de la ronda {numero}</h2>
      <div className="campo"><span className="etq">Término</span><Opciones etiqueta="Término" valores={m.glosario.map((t) => t.termino)} valor={d.termino} onElegir={(x) => f.poner('termino', x)} /></div>
      <div className="campo"><span className="etq">Técnica</span><Opciones etiqueta="Técnica" valores={TECNICA_I3} valor={d.tecnica} onElegir={(x) => f.poner('tecnica', x)} /></div>
      <AreaTexto etiqueta="Pregunta" valor={d.pregunta} onCambio={(t) => f.poner('pregunta', t)} />
      <div className="fila">
        <button type="button" className="btn sec" onClick={onListo}>Volver</button>
        {f.hayCambios && <button type="button" className="enlace" onClick={() => { f.limpiar(); onListo(); }}>Descartar cambios</button>}
        <button type="button" className="btn" disabled={envio.enviando || !d.pregunta.trim()} onClick={guardar}>Guardar el ítem</button>
      </div>
      <Mensajes error={envio.error} />
    </div>
  );
}

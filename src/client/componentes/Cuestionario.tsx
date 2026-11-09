import { useEffect, useId, useRef } from 'react';
import { usarMesa } from '../contexto.js';
import { cuestionarioCompleto, normalizarCuestionario, pasoCuestionarioCompleto, pasosCuestionario, type PasoCuestionario } from '../cuestionario.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

const ESCALA = ['1', '2', '3', '4', '5'] as const;
const TITULOS: Record<PasoCuestionario, string> = {
  experiencia: 'Tu experiencia', utilidad: 'Utilidad del proceso', carga: 'Esfuerzo de la actividad', comentarios: 'Comentarios y envío',
};

export function Cuestionario() {
  const { v } = usarMesa();
  return v.cuestionario ? <FormularioCuestionario /> : null;
}

function FormularioCuestionario() {
  const { v, enviar } = usarMesa();
  const c = v.cuestionario!;
  const preguntas = c.preguntas;
  const envio = usarEnvio();
  const f = usarFormulario('cuestionario', normalizarCuestionario(preguntas));
  const d = normalizarCuestionario(preguntas, f.datos);
  const pasos = pasosCuestionario(preguntas);
  const paso = pasos[d.paso];
  const completo = cuestionarioCompleto(preguntas, d);
  const excede = excedeTexto(d.abierta, d.utilidad.abierta);
  const heading = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [d.paso]);
  if (c.respondido) return <p className="listo" role="status">Respuestas enviadas. Gracias por participar.</p>;

  function irA(indice: number) {
    f.poner('paso', indice);
  }
  async function mandar() {
    const datos = {
      afirmaciones: d.afirmaciones as number[], tlx: d.tlx as number[], abierta: d.abierta.trim(),
      ...(preguntas.utilidad ? { utilidad: { respuestas: d.utilidad.respuestas, abierta: d.utilidad.abierta.trim() } } : {}),
    };
    if (await envio.correr(() => enviar('responderCuestionario', datos), 'Enviado')) f.limpiar();
  }

  return (
    <section className="cuestionario" aria-labelledby={heading}>
      <div className="encuesta-progreso">
        <p className="progreso" aria-live="polite">Paso {d.paso + 1} de {pasos.length}</p>
        <progress max={pasos.length} value={d.paso + 1} aria-label="Avance del cuestionario" />
      </div>
      <fieldset disabled={envio.enviando} className="papel formulario-bloqueable" aria-labelledby={heading}>
        <h2 id={heading} ref={titulo} tabIndex={-1}>{TITULOS[paso]}</h2>
        {paso === 'experiencia' && <>
          <p className="nota">Valora cada afirmación: 1, nada de acuerdo; 2, poco de acuerdo; 3, ni de acuerdo ni en desacuerdo; 4, de acuerdo; 5, totalmente de acuerdo.</p>
          {preguntas.afirmaciones.map((texto, i) => <Afirmacion
            key={texto} texto={texto} valor={d.afirmaciones[i]}
            onCambio={(n) => f.poner('afirmaciones', d.afirmaciones.map((valor, j) => j === i ? n : valor))}
          />)}
        </>}
        {paso === 'utilidad' && preguntas.utilidad && <>
          <p className="nota">Piensa en los pasos de la actividad y en lo que lograron comprender y acordar. Usa la misma escala de 1 (nada de acuerdo) a 5 (totalmente de acuerdo).</p>
          {preguntas.utilidad.items.map((item) => <Afirmacion
            key={item.id} texto={item.texto} valor={d.utilidad.respuestas[item.id] ?? null}
            onCambio={(n) => f.poner('utilidad', { ...d.utilidad, respuestas: { ...d.utilidad.respuestas, [item.id]: n } })}
          />)}
        </>}
        {paso === 'carga' && <>
          <p className="nota">Toca o desliza cada barra hasta el punto que mejor describe la sesión, de 0 a 100. Más a la derecha es más carga; en rendimiento, más a la derecha es un rendimiento menos satisfactorio.</p>
          {preguntas.tlx.map((escala, i) => <EscalaCuestionario
            key={escala.id} nombre={escala.nombre} descripcion={escala.descripcion} bajo={escala.bajo} alto={escala.alto} valor={d.tlx[i]}
            onCambio={(n) => f.poner('tlx', d.tlx.map((valor, j) => j === i ? n : valor))}
          />)}
        </>}
        {paso === 'comentarios' && <>
          {preguntas.utilidad && <AreaTexto
            etiqueta={preguntas.utilidad.abierta} valor={d.utilidad.abierta}
            onCambio={(texto) => f.poner('utilidad', { ...d.utilidad, abierta: texto })} ayuda="Opcional. Puedes indicar que no te ayudó."
          />}
          <AreaTexto etiqueta={preguntas.abierta} valor={d.abierta} onCambio={(texto) => f.poner('abierta', texto)} ayuda="Opcional." />
          <p className="nota">Puedes volver a los pasos anteriores para revisar tus respuestas antes de enviarlas.</p>
        </>}
        <div className="fila encuesta-acciones">
          {d.paso > 0 && <button type="button" className="btn sec" disabled={envio.enviando} onClick={() => irA(d.paso - 1)}>Anterior</button>}
          {d.paso < pasos.length - 1
            ? <button type="button" className="btn" disabled={!pasoCuestionarioCompleto(paso, preguntas, d)} onClick={() => irA(d.paso + 1)}>Siguiente</button>
            : <button type="button" className="btn ok" disabled={envio.enviando || !completo || excede} onClick={mandar}>{envio.enviando ? 'Enviando…' : 'Enviar respuestas'}</button>}
        </div>
        {!pasoCuestionarioCompleto(paso, preguntas, d) && <p className="nota">{paso === 'carga' ? 'Toca o desliza las seis barras para continuar.' : 'Responde las afirmaciones de este paso para continuar.'}</p>}
        {paso === 'comentarios' && !completo && <p className="nota">Antes de enviar, vuelve atrás y responde todas las afirmaciones y las seis barras.</p>}
        {excede && <p className="error">Acorta los comentarios que superan el límite de texto para poder enviarlos.</p>}
      </fieldset>
      <Mensajes error={envio.error} />
      <p className="nota">Tus respuestas se conservan al cambiar de paso.</p>
    </section>
  );
}

function Afirmacion(p: { texto: string; valor: number | null; onCambio: (n: number) => void }) {
  return <div className="campo afirmacion">
    <span className="etq">{p.texto}</span>
    <Opciones etiqueta={p.texto} valores={ESCALA} valor={p.valor === null ? undefined : String(p.valor) as (typeof ESCALA)[number]} onElegir={(n) => p.onCambio(Number(n))} />
    <div className="extremos" aria-hidden="true"><span>Nada de acuerdo</span><span>Totalmente de acuerdo</span></div>
  </div>;
}

// Sin respuesta, la barra se ve en el centro pero apagada. Basta tocarla: al soltar el dedo queda el valor de ese
// punto, aunque no se haya movido (en los celulares un toque sin arrastre no dispara «change»).
export function EscalaCuestionario(p: { nombre: string; descripcion: string; bajo: string; alto: string; valor: number | null; onCambio: (n: number) => void }) {
  const id = useId();
  const sinResponder = p.valor === null;
  const tomar = (e: { currentTarget: HTMLInputElement }) => p.onCambio(Number(e.currentTarget.value));
  return <div className={`escala${sinResponder ? ' sin-responder' : ''}`}>
    <label className="etq" htmlFor={id}>{p.nombre} · <output htmlFor={id}>{sinResponder ? 'Sin responder' : `${p.valor} de 100`}</output></label>
    <p id={`${id}-ayuda`} className="nota">{p.descripcion}</p>
    <input
      id={id} type="range" min={0} max={100} step={5} value={p.valor ?? 50}
      aria-valuetext={sinResponder ? 'Sin responder' : `${p.valor} de 100`} aria-describedby={`${id}-ayuda`}
      onChange={tomar} onPointerUp={tomar} onKeyUp={tomar} onClick={tomar}
    />
    <div className="extremos"><span>{p.bajo}</span><span>{p.alto}</span></div>
  </div>;
}

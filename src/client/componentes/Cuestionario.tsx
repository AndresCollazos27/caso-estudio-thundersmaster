import { useId } from 'react';
import { usarMesa } from '../contexto.js';
import { AreaTexto, Mensajes, Opciones, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

const ESCALA = ['1', '2', '3', '4', '5'] as const;

// Al cerrar la sesión: cinco afirmaciones de 1 a 5, las seis escalas de NASA-TLX (0 a 100, de 5 en 5) y una pregunta abierta.
export function Cuestionario() {
  const { v, enviar } = usarMesa();
  const envio = usarEnvio();
  const f = usarFormulario('cuestionario', {
    afirmaciones: [null, null, null, null, null] as (number | null)[],
    tlx: [null, null, null, null, null, null] as (number | null)[],
    abierta: '',
  });
  const c = v.cuestionario;
  if (!c) return null;
  if (c.respondido) return <p className="listo">Listo. Gracias por participar.</p>;
  const d = f.datos;
  const completo = d.afirmaciones.every((x) => x !== null) && d.tlx.every((x) => x !== null);
  async function mandar() {
    const datos = { afirmaciones: d.afirmaciones as number[], tlx: d.tlx as number[], abierta: d.abierta.trim() };
    if (await envio.correr(() => enviar('responderCuestionario', datos), 'Enviado')) f.limpiar();
  }
  return (
    <>
      <div className="papel">
        <h2>¿Qué tan de acuerdo estás?</h2>
        <p className="nota">1 es «nada de acuerdo» y 5 es «totalmente de acuerdo».</p>
        {c.preguntas.afirmaciones.map((texto, i) => (
          <div key={texto} className="campo">
            <span className="etq" style={{ color: 'var(--app-ink)' }}>{texto}</span>
            <Opciones
              etiqueta={texto} valores={ESCALA} valor={d.afirmaciones[i] === null ? undefined : String(d.afirmaciones[i]) as (typeof ESCALA)[number]}
              onElegir={(x) => f.poner('afirmaciones', d.afirmaciones.map((y, j) => (j === i ? Number(x) : y)))}
            />
          </div>
        ))}
      </div>
      <div className="papel">
        <h2>¿Cuánto te exigió la actividad?</h2>
        {c.preguntas.tlx.map((escala, i) => (
          <Escala
            key={escala.id} nombre={escala.nombre} descripcion={escala.descripcion} bajo={escala.bajo} alto={escala.alto} valor={d.tlx[i]}
            onCambio={(n) => f.poner('tlx', d.tlx.map((y, j) => (j === i ? n : y)))}
          />
        ))}
      </div>
      <div className="papel">
        <AreaTexto etiqueta={c.preguntas.abierta} valor={d.abierta} onCambio={(t) => f.poner('abierta', t)} ayuda="Opcional." />
        {!completo && <p className="nota">Responde las cinco afirmaciones y mueve las seis barras para poder enviar.</p>}
        <button type="button" className="btn ok" disabled={envio.enviando || !completo || excedeTexto(d.abierta)} onClick={mandar}>Enviar el cuestionario</button>
        <Mensajes error={envio.error} />
      </div>
    </>
  );
}

function Escala(p: { nombre: string; descripcion: string; bajo: string; alto: string; valor: number | null; onCambio: (n: number) => void }) {
  const id = useId();
  return (
    <div className="escala">
      <label className="etq" htmlFor={id} style={{ color: 'var(--app-ink)' }}>{p.nombre}{p.valor !== null ? ` · ${p.valor}` : ''}</label>
      <p className="nota">{p.descripcion}</p>
      <input
        id={id} type="range" min={0} max={100} step={5} value={p.valor ?? 50} aria-valuetext={p.valor === null ? 'Sin responder' : String(p.valor)}
        onChange={(e) => p.onCambio(Number(e.target.value))} onClick={(e) => p.onCambio(Number((e.target as HTMLInputElement).value))}
      />
      <div className="extremos"><span>{p.bajo}</span><span>{p.alto}</span></div>
    </div>
  );
}

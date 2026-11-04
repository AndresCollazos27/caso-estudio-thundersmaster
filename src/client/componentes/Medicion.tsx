import { useId, useState } from 'react';
import { usarMesa } from '../contexto.js';
import { Mensajes, excedeTexto, usarEnvio, usarFormulario } from './comunes.js';

// Las cuatro preguntas de la medición, una por pantalla. Se envían juntas al final.
export function Medicion() {
  const { v, enviar } = usarMesa();
  const med = v.medicion;
  const f = usarFormulario(`medicion:${med?.fase ?? ''}`, { respuestas: ['', '', '', ''] });
  const [i, setI] = useState(0);
  const envio = usarEnvio();
  const id = useId();
  if (!med) return null;
  if (med.respondida) return <p className="listo">Listo, ya respondiste. Gracias.</p>;
  const respuestas = f.datos.respuestas;
  const p = med.preguntas[i];
  const poner = (t: string) => f.poner('respuestas', respuestas.map((x, j) => (j === i ? t : x)));
  const ultima = i === med.preguntas.length - 1;
  async function mandar() {
    if (await envio.correr(() => enviar('responderMedicion', { fase: med!.fase, respuestas: respuestas.map((x) => x.trim()) }), 'Enviado')) f.limpiar();
  }
  return (
    <div className="papel">
      <p className="progreso">Pregunta {i + 1} de {med.preguntas.length}</p>
      <label className="etq" htmlFor={id} style={{ fontSize: 17, color: 'var(--app-ink)' }}>{p.pregunta}</label>
      <input id={id} type="text" inputMode={p.tipo === 'numero' ? 'decimal' : 'text'} value={respuestas[i]} onChange={(e) => poner(e.target.value)} autoComplete="off" />
      <button type="button" className="enlace" style={{ justifySelf: 'start' }} onClick={() => poner('No sé')}>No lo sé</button>
      <div className="fila">
        {i > 0 && <button type="button" className="btn sec" onClick={() => setI(i - 1)}>Anterior</button>}
        {!ultima && <button type="button" className="btn" disabled={!respuestas[i].trim()} onClick={() => setI(i + 1)}>Siguiente</button>}
        {ultima && (
          <button type="button" className="btn ok" disabled={envio.enviando || respuestas.some((x) => !x.trim()) || excedeTexto(...respuestas)} onClick={mandar}>
            Enviar respuestas
          </button>
        )}
      </div>
      <Mensajes error={envio.error} />
    </div>
  );
}

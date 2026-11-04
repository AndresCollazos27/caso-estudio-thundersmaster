import { usarMesa } from '../contexto.js';
import { CampoTexto } from './CampoTexto.js';

// A5.2: el cliente, sin ver las tarjetas, escribe qué resultado espera de cada necesidad de prioridad alta.
// El texto llega a la columna H de la parte C de I2.
export function Esperados() {
  const { m, enviar } = usarMesa();
  const altas = m.necesidades.filter((n) => n.prioridad === 'Alta');
  const lista = altas.length > 0 ? altas : m.necesidades;
  if (lista.length === 0) return <p className="nota">Tu mesa todavía no registró necesidades.</p>;
  return (
    <>
      {lista.map((n) => (
        <div key={n.id} className="papel">
          <span className="id">{n.id}{n.prioridad ? ` · ${n.prioridad}` : ''}</span>
          <p>{n.necesidad}</p>
          <CampoTexto
            etiqueta="Qué resultado esperas, con tus palabras" clave={`esperado:${n.id}`} boton="Guardar" listo="Guardado"
            inicial={m.esperadosPorNecesidad[n.id]} onEnviar={(texto) => enviar('escribirEsperado', { necesidadId: n.id, texto })}
          />
        </div>
      ))}
    </>
  );
}

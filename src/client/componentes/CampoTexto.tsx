import { useState } from 'react';
import type { Respuesta } from '../conexion.js';
import { usarMesa } from '../contexto.js';
import { AreaTexto, Mensajes, excedeTexto, usarEnvio } from './comunes.js';

// Un texto que se escribe, queda como borrador en el celular y se envía con un botón.
export function CampoTexto(p: {
  etiqueta: string;
  clave: string;
  inicial?: string;
  boton: string;
  onEnviar: (texto: string) => Promise<Respuesta>;
  corto?: boolean;
  ayuda?: string;
  listo?: string;
  vacioPermitido?: boolean;
}) {
  const { borradores } = usarMesa();
  const [texto, setTexto] = useState(() => borradores.leer(p.clave) || p.inicial || '');
  const envio = usarEnvio();
  const cambiar = (t: string) => {
    setTexto(t);
    borradores.guardar(p.clave, t);
  };
  async function enviar() {
    if (await envio.correr(() => p.onEnviar(texto.trim()), p.listo ?? 'Enviado')) borradores.borrar(p.clave);
  }
  const vacio = !texto.trim() && !p.vacioPermitido;
  return (
    <div className="campo">
      <AreaTexto etiqueta={p.etiqueta} valor={texto} onCambio={cambiar} corto={p.corto} ayuda={p.ayuda} />
      <button type="button" className="btn" disabled={envio.enviando || vacio || excedeTexto(texto)} onClick={enviar}>
        {envio.enviando ? 'Enviando…' : p.boton}
      </button>
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

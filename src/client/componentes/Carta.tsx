import { usarMesa } from '../contexto.js';
import { Mensajes, usarEnvio } from './comunes.js';

// La carta secreta (PO, SD, Carmen, AN y QA) o la hoja de rol (FR y RT). Solo la ve su dueño.
export function Carta() {
  const { v, enviar } = usarMesa();
  const envio = usarEnvio();
  const conHoja = v.yo.roles.filter((r) => r === 'FR' || r === 'RT');
  return (
    <div className="papel">
      {v.carta && (
        <>
          <div className="sec"><h3>Quién eres</h3><p>{v.carta.quienEres}</p></div>
          <div className="sec"><h3>Lo que vienes a pedir</h3><ul>{v.carta.vienesAPedir.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="sec"><h3>Lo que das por hecho</h3><ul>{v.carta.dasPorHecho.map((x) => <li key={x}>{x}</li>)}</ul></div>
          {v.carta.comoHablas && <div className="sec"><h3>Cómo hablas</h3><p>{v.carta.comoHablas}</p></div>}
        </>
      )}
      {v.hojas.map((texto, i) => (
        <div key={conHoja[i] ?? i} className="sec">
          <h3>Tu hoja de {conHoja[i] ?? 'rol'}</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{texto}</p>
        </div>
      ))}
      {v.yo.cartaLeida
        ? <p className="listo">Ya la leíste. Puedes volver a abrirla cuando quieras.</p>
        : <button type="button" className="btn ok" disabled={envio.enviando} onClick={() => envio.correr(() => enviar('leerCarta', {}), 'Listo')}>Ya la leí</button>}
      <Mensajes error={envio.error} />
    </div>
  );
}

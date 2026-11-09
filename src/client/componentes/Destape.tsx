import { usarMesa } from '../contexto.js';
import { textoRoles } from '../../shared/roles.js';
import { puedo } from '../textos.js';
import { Mensajes, Opciones, usarEnvio } from './comunes.js';

// Las ocho divergencias sembradas. El FR marca cuáles registró su mesa; los demás las comentan.
export function Destape() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const editable = puedo(v, 'marcarDestape');
  return (
    <div className="papel">
      <h2>Las ocho divergencias sembradas</h2>
      {(v.destape ?? []).map((t) => {
        const marca = m.destape[t.id];
        return (
          <div key={t.id} className="req">
            <span className="id">{t.id}</span>
            <b>{textoRoles(t.titulo)}</b>
            <p className="nota">{textoRoles(t.detalle)}</p>
            {editable
              ? (
                <Opciones
                  etiqueta={`¿Tu mesa registró ${t.id}?`} valores={['Sí', 'No'] as const} valor={marca === undefined ? undefined : marca ? 'Sí' : 'No'}
                  nombres={{ Sí: 'La registramos', No: 'No la registramos' }} deshabilitado={envio.enviando}
                  onElegir={(x) => envio.correr(() => enviar('marcarDestape', { divergencia: t.id, registrada: x === 'Sí' }), 'Marcado')}
                />
              )
              : marca !== undefined && <span className={`chip ${marca ? 'ok' : 'warn'}`}>{marca ? 'Tu mesa la registró' : 'Tu mesa no la registró'}</span>}
          </div>
        );
      })}
      <Mensajes error={envio.error} />
    </div>
  );
}

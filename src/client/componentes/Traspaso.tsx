import { usarMesa } from '../contexto.js';
import { tiene } from '../textos.js';
import { CampoTexto } from './CampoTexto.js';
import { Mensajes, Opciones, usarEnvio } from './comunes.js';
import { TarjetaLeida } from './Tarjetas.js';

// Prueba de traspaso (E5): el QA de otra mesa reconstruye los críticos de la muestra y el PO de origen confirma.
// Hasta que se reparte (unos minutos después de empezar el cierre), cada uno sabe qué va a llegar a su celular.
export function Traspaso() {
  const { v } = usarMesa();
  return (
    <>
      {v.traspaso.comoLector
        ? <ComoLector />
        : tiene(v, 'QA') && <Espera texto="En unos minutos, los requisitos críticos de la mesa siguiente aparecerán aquí para que escribas qué entendiste." />}
      {v.traspaso.comoPO
        ? <ComoPO />
        : tiene(v, 'PO') && <Espera texto="Cuando el responsable de calidad de otra mesa lea la línea base de tu mesa, verás aquí qué entendió, para confirmar si coincide." />}
    </>
  );
}

function Espera({ texto }: { texto: string }) {
  return (
    <div className="papel">
      <h2>Traspaso a otra mesa</h2>
      <p className="nota">{texto}</p>
    </div>
  );
}

function ComoLector() {
  const { v, enviar } = usarMesa();
  const lector = v.traspaso.comoLector!;
  const cliente = v.roles.PO?.nombre.split(' ')[0] ?? 'la persona responsable de decisión';
  return (
    <div className="papel">
      <h2>Traspaso: línea base de la mesa {lector.mesa}</h2>
      {lector.tarjetas.length === 0 && <p className="nota">Esa mesa no tiene requisitos críticos en su línea base.</p>}
      {lector.tarjetas.map((t) => (
        <div key={t.id} className="req">
          <span className="id">{t.id} · Mesa {lector.mesa}</span>
          <p>{t.enunciado}</p>
          {t.criterioEjemplo && <p className="ej">{t.criterioEjemplo}</p>}
          <CampoTexto
            etiqueta="Qué entendiste" clave={`traspaso:${lector.mesa}:${t.id}`} inicial={lector.mias[t.id]} listo="Enviado"
            boton={`Enviar a la ${cliente} de la mesa ${lector.mesa}`}
            onEnviar={(texto) => enviar('reconstruir', { tarjetaId: t.id, texto })}
          />
        </div>
      ))}
    </div>
  );
}

function ComoPO() {
  const { m, v, enviar } = usarMesa();
  const envio = usarEnvio();
  const items = Object.entries(v.traspaso.comoPO ?? {});
  return (
    <div className="papel">
      <h2>Traspaso: ¿te entendieron?</h2>
      {items.length === 0 && <p className="nota">Esperando lo que entendió el responsable de calidad de otra mesa.</p>}
      {items.map(([id, item]) => {
        const t = m.tarjetas.find((x) => x.id === id);
        return (
          <div key={id} className="req">
            {t && <TarjetaLeida t={t} />}
            <p className="ans"><span className="quien">Lo que entendió el responsable de calidad de otra mesa</span>{item.reconstruccion}</p>
            <Opciones
              etiqueta={`¿Coincide ${id}?`} valores={['Sí', 'No'] as const} valor={item.coincide} nombres={{ Sí: 'Coincide', No: 'No coincide' }} deshabilitado={envio.enviando}
              onElegir={(coincide) => envio.correr(() => enviar('confirmarTraspaso', { tarjetaId: id, coincide, correccion: item.correccion }), coincide === 'No' ? 'Se registró en 06' : 'Confirmado')}
            />
            {item.coincide === 'No' && (
              <CampoTexto
                etiqueta="Qué se corrigió (tarjeta o paquete)" clave={`correccion:${id}`} inicial={item.correccion} boton="Guardar la corrección" listo="Guardada"
                onEnviar={(correccion) => enviar('confirmarTraspaso', { tarjetaId: id, coincide: 'No', correccion })}
              />
            )}
          </div>
        );
      })}
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

import { SI_NO_PEND, type SiNoPend } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo } from '../textos.js';
import { CampoTexto } from './CampoTexto.js';
import { Mensajes, Opciones, usarEnvio } from './comunes.js';

// Textos de la hoja I3 del libro de la versión final (cierre de bloque, ítems 5 y 6).
const C5 = '¿Los términos nuevos tienen una definición acordada en el glosario? En los términos críticos, ¿una comprobación breve muestra que perfiles distintos interpretan la definición de la misma manera?';
const C6 = 'Control de trazabilidad: ¿cada requisito crítico tiene anotadas su necesidad y la persona que la aportó?';

// Los chequeos de cierre de bloque que hace el FR al final de A5.1.
export function ChequeosBloque() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  if (!puedo(v, 'marcarChequeos')) return null;
  const marcar = (campo: 'c5' | 'c6', valor: SiNoPend) => envio.correr(() => enviar('marcarChequeos', { [campo]: valor }), 'Marcado');
  return (
    <div className="papel">
      <h2>Cierre de bloque (I3)</h2>
      <div className="campo">
        <span className="etq">5 · {C5}</span>
        <Opciones etiqueta="Chequeo 5" valores={SI_NO_PEND} valor={m.chequeosBloque.c5} onElegir={(x) => marcar('c5', x)} />
      </div>
      <div className="campo">
        <span className="etq">6 · {C6}</span>
        <Opciones etiqueta="Chequeo 6" valores={SI_NO_PEND} valor={m.chequeosBloque.c6} onElegir={(x) => marcar('c6', x)} />
      </div>
      <Mensajes error={envio.error} listo={envio.listo} />
      <CampoTexto
        etiqueta="Observación" clave="chequeos:obs" boton="Guardar la observación" inicial={m.chequeosBloque.obs} vacioPermitido
        onEnviar={(obs) => enviar('marcarChequeos', { obs })} listo="Guardada"
      />
    </div>
  );
}

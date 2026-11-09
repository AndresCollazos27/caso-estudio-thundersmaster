import type { PerfilApertura } from '../../shared/tipos.js';
import { SI_NO } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { etiquetaRol, puedo, tiene } from '../textos.js';
import { CampoTexto } from './CampoTexto.js';
import { Mensajes, Opciones, usarEnvio } from './comunes.js';

const PERFILES: PerfilApertura[] = ['PO', 'SD', 'AN'];

// A4: PO, SD y AN escriben su versión del problema; el FR la lee en voz alta y marca si dicen lo mismo.
export function Apertura() {
  const { v, m, enviar } = usarMesa();
  const perfil = PERFILES.find((r) => v.yo.roles.includes(r));
  const decl = v.contexto?.declaracion;
  return (
    <>
      {decl && (
        <div className="papel">
          <h3>Declaración del problema (01)</h3>
          <p>{decl.enunciado}</p>
          <p className="nota">Afecta a: {decl.afectados}</p>
          <p className="nota">{decl.contraste}</p>
        </div>
      )}
      {perfil && puedo(v, 'escribirVersion') && (
        <CampoTexto
          etiqueta="Tu versión" clave="version" boton="Enviar mi versión" inicial={m.apertura.versiones[perfil]?.texto}
          ayuda="Qué problema resuelve Tomatera, qué entra y qué resultado esperas."
          onEnviar={(texto) => enviar('escribirVersion', { texto })}
        />
      )}
      {tiene(v, 'FR') && <MarcasFR />}
    </>
  );
}

function MarcasFR() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const editable = puedo(v, 'marcarEquivalencia');
  return (
    <div className="papel">
      <h2>Las tres versiones</h2>
      {PERFILES.map((p) => {
        const version = m.apertura.versiones[p];
        return (
          <div key={p} className="campo">
            <span className="etq">{etiquetaRol(v.roles, p)}</span>
            {version ? <p className="ans">{version.texto}</p> : <p className="nota">Todavía no llegó.</p>}
            {version && (
              <Opciones
                etiqueta={`¿La versión de ${etiquetaRol(v.roles, p)} dice lo mismo?`} valores={SI_NO} valor={m.apertura.equivalencia[p]} deshabilitado={!editable || envio.enviando}
                nombres={{ Sí: 'Dice lo mismo', No: 'No dice lo mismo' }}
                onElegir={(valor) => envio.correr(() => enviar('marcarEquivalencia', { perfil: p, valor }), valor === 'No' ? 'Marcado; se creó una divergencia en 06' : 'Marcado')}
              />
            )}
          </div>
        );
      })}
      <Mensajes error={envio.error} listo={envio.listo} />
      {editable && (
        <CampoTexto
          etiqueta="Ajustes acordados" clave="ajustes" boton="Guardar ajustes" inicial={m.apertura.ajustes} vacioPermitido
          onEnviar={(texto) => enviar('guardarAjustes', { texto })} listo="Guardado"
        />
      )}
    </div>
  );
}

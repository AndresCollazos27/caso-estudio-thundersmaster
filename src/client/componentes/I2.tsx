import { REVISION_I2A, SI_NO_PEND, type RevisionI2A } from '../../shared/valores.js';
import { usarMesa } from '../contexto.js';
import { puedo, tiene } from '../textos.js';
import { CampoTexto } from './CampoTexto.js';
import { Mensajes, Opciones, usarEnvio } from './comunes.js';
import { TarjetaLeida } from './Tarjetas.js';

// Preguntas de la hoja I2 del libro de la versión final.
const PREGUNTAS_A = [
  'A1 · ¿El requisito está formulado de manera que los perfiles involucrados puedan identificar inequívocamente el comportamiento, las condiciones y el resultado esperado?',
  'A2 · ¿Usa los términos del dominio tal como los define el glosario acordado?',
  'A3 · ¿Tiene un criterio de aceptación observable que permite demostrar que se cumple? En los requisitos no funcionales, ¿el criterio es medible y especifica las condiciones de evaluación cuando corresponde?',
  'A4 · ¿Conserva el vínculo con la necesidad que lo originó?',
];
const PREGUNTAS_B = {
  B1: '¿Se verificó que no existen requisitos duplicados o redundantes que expresen esencialmente la misma obligación del sistema? Varios requisitos pueden responder a una misma necesidad sin ser redundantes.',
  B2: '¿Se identificaron y resolvieron las contradicciones o incompatibilidades entre los requisitos especificados, considerando las condiciones de aplicación de cada uno?',
} as const;
const CAMPOS_C = {
  C1: 'C1 · ¿Expresa su necesidad?',
  C2: 'C2 · ¿Confirma ejemplo y criterio?',
  C3: 'C3 · ¿Interpretan igual SD y QA?',
} as const;

// Parte A (A5.2, QA y AN): se revisa cada tarjeta y solo se anota lo que no cumple.
export function I2ParteA() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  if (!puedo(v, 'marcarI2A') || m.tarjetas.length === 0) return null;
  const marcar = (tarjetaId: string, revision: RevisionI2A, nota?: string) =>
    envio.correr(() => enviar('marcarI2A', { tarjetaId, revision, ...(nota !== undefined ? { nota } : {}) }), 'Marcado');
  return (
    <div className="papel">
      <h2>I2 · parte A: calidad de cada requisito</h2>
      <details>
        <summary className="nota">Las cuatro preguntas</summary>
        <ul className="nota">{PREGUNTAS_A.map((p) => <li key={p}>{p}</li>)}</ul>
      </details>
      {m.tarjetas.map((t) => {
        const fila = m.i2a[t.id];
        return (
          <div key={t.id} className="req">
            <TarjetaLeida t={t} />
            <Opciones etiqueta={`Revisión de ${t.id}`} valores={REVISION_I2A} valor={fila?.revision} onElegir={(x) => marcar(t.id, x, fila?.nota)} />
            {fila && fila.revision !== 'Cumple' && (
              <CampoTexto
                etiqueta="Ítem que falla y qué corregir" clave={`i2a:${t.id}`} inicial={fila.nota} boton="Guardar la nota" listo="Guardada"
                onEnviar={(nota) => enviar('marcarI2A', { tarjetaId: t.id, revision: fila.revision, nota })}
              />
            )}
          </div>
        );
      })}
      <Mensajes error={envio.error} />
    </div>
  );
}

// Parte B (A5.3, AN y QA): calidad del conjunto. B3 es automática.
export function I2ParteB() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const editable = puedo(v, 'marcarI2B');
  if (!editable && !tiene(v, 'FR', 'RT')) return null;
  return (
    <div className="papel">
      <h2>I2 · parte B: calidad del conjunto</h2>
      {(['B1', 'B2'] as const).map((campo) => (
        <div key={campo} className="campo">
          <span className="etq">{campo} · {PREGUNTAS_B[campo]}</span>
          <Opciones
            etiqueta={campo} valores={SI_NO_PEND} valor={m.i2b[campo]} deshabilitado={!editable}
            onElegir={(valor) => envio.correr(() => enviar('marcarI2B', { campo, valor, obs: campo === 'B1' ? m.i2b.obsB1 : m.i2b.obsB2 }), 'Marcado')}
          />
        </div>
      ))}
      {v.lecturas && <p className="nota">B3 · ¿Toda necesidad priorizada tiene al menos un requisito? {v.lecturas.B3.texto}</p>}
      <Mensajes error={envio.error} />
    </div>
  );
}

// Parte C (A5.3): por cada tarjeta crítica, el cliente marca C1 y C2 y el FR marca C3.
export function I2ParteC() {
  const { v, m, enviar } = usarMesa();
  const envio = usarEnvio();
  const filas = Object.entries(m.i2c);
  const puedeMarcar = puedo(v, 'marcarI2C');
  const esCliente = tiene(v, 'PO', 'SD', 'SD2');
  const mios = (Object.keys(CAMPOS_C) as (keyof typeof CAMPOS_C)[]).filter((c) => (c === 'C3' ? tiene(v, 'FR') : esCliente));
  if (filas.length === 0) return <p className="nota">Tu mesa todavía no tiene tarjetas críticas.</p>;
  return (
    <div className="papel">
      <h2>I2 · parte C: validación de los críticos</h2>
      {filas.map(([id, fila]) => {
        const t = m.tarjetas.find((x) => x.id === id);
        return (
          <div key={id} className="req">
            {t && <TarjetaLeida t={t} />}
            {fila.esperado && <p className="nota">Lo que espera el cliente: «{fila.esperado}»</p>}
            {!fila.esperado && t && esCliente && puedo(v, 'escribirEsperado') && (
              <CampoTexto
                etiqueta="C1 · Resultado que esperas, con tus palabras" clave={`esperado:${t.necesidadId}`} boton="Guardar" listo="Guardado"
                onEnviar={(texto) => enviar('escribirEsperado', { necesidadId: t.necesidadId, texto })}
              />
            )}
            {(Object.keys(CAMPOS_C) as (keyof typeof CAMPOS_C)[]).map((campo) => (
              <div key={campo} className="campo">
                <span className="etq">{CAMPOS_C[campo]}</span>
                <Opciones
                  etiqueta={`${campo} de ${id}`} valores={SI_NO_PEND} valor={fila[campo]} deshabilitado={!puedeMarcar || !mios.includes(campo)}
                  onElegir={(valor) => envio.correr(() => enviar('marcarI2C', { tarjetaId: id, campo, valor }), valor === 'No' ? 'Marcado; se registra en 06' : 'Marcado')}
                />
              </div>
            ))}
            <p>Resultado: <span className={`chip ${claseResultado(fila.resultado)}`}>{fila.resultado}</span>{fila.divergenciaId ? ` · ${fila.divergenciaId}` : ''}</p>
          </div>
        );
      })}
      <Mensajes error={envio.error} listo={envio.listo} />
    </div>
  );
}

const claseResultado = (r: string) => (r === 'Aceptado' ? 'ok' : r.startsWith('Divergencia') ? 'mal' : 'warn');

import { useEffect, useState, type ReactNode } from 'react';
import type { Contenido } from '../../shared/contenido.js';
import { Qr } from '../componentes/Qr.js';

interface Datos {
  contenido: Contenido;
  sesion: { codigo: string; enlace: string } | null;
}

const PARTES: [string, string][] = [
  ['cartas', 'Cartas'], ['hojas', 'Hojas de rol'], ['plantillas', 'Plantillas'], ['medicion', 'Medición'],
  ['cuestionario', 'Cuestionario'], ['qr', 'QR'], ['carteles', 'Carteles de mesa'],
];

// Respaldo impreso, con los mismos identificadores que la app (N-01, R-01, D-01…). Se imprime desde el navegador.
export function Imprimir() {
  const q = new URLSearchParams(window.location.search);
  const k = q.get('k') ?? '';
  const s = q.get('s');
  const parte = window.location.pathname.replace(/^\/imprimir\/?/, '').replace(/\/+$/, '') || 'cartas';
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sufijo = `?k=${encodeURIComponent(k)}${s ? `&s=${encodeURIComponent(s)}` : ''}`;
  useEffect(() => {
    fetch(`/api/autores/contenido${sufijo}`)
      .then(async (r) => {
        const x = await r.json();
        if (r.ok) setDatos(x);
        else setError(x.error ?? 'No se pudo leer el contenido');
      })
      .catch(() => setError('No se pudo conectar con el servidor'));
  }, [sufijo]);
  return (
    <div className="impr">
      <nav className="noimp" aria-label="Partes">
        {PARTES.map(([p, nombre]) => <a key={p} href={`/imprimir/${p}${sufijo}`} aria-current={p === parte ? 'page' : undefined}>{nombre}</a>)}
        <button type="button" onClick={() => window.print()}>Imprimir esta parte</button>
      </nav>
      {error && <p className="error">{error}</p>}
      {datos && <Parte parte={parte} d={datos} />}
    </div>
  );
}

function Parte({ parte, d }: { parte: string; d: Datos }) {
  const c = d.contenido;
  switch (parte) {
    case 'cartas': return <Cartas c={c} />;
    case 'hojas': return <Hojas c={c} />;
    case 'plantillas': return <Plantillas c={c} />;
    case 'medicion': return <MedicionImpresa c={c} />;
    case 'cuestionario': return <CuestionarioImpreso c={c} />;
    case 'qr': return <QrImpreso d={d} />;
    case 'carteles': return <>{[1, 2, 3, 4, 5, 6, 7].map((n) => <section key={n} className="pagina"><p className="cartel">Mesa {n}</p></section>)}</>;
    default: return <p className="error">No existe esa parte.</p>;
  }
}

const id = (prefijo: string, n: number) => `${prefijo}-${String(n).padStart(2, '0')}`;

function Pagina({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className="pagina">
      <h1>{titulo}</h1>
      {subtitulo && <p>{subtitulo}</p>}
      {children}
    </section>
  );
}

// Una tabla con encabezados y filas en blanco para escribir a mano.
function Tabla({ columnas, filas }: { columnas: string[]; filas: ReactNode[][] }) {
  return (
    <table className="rellenar">
      <thead><tr>{columnas.map((x) => <th key={x}>{x}</th>)}</tr></thead>
      <tbody>{filas.map((f, i) => <tr key={i}>{f.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody>
    </table>
  );
}

const vacias = (n: number, columnas: number, prefijo?: string, desde = 1) =>
  Array.from({ length: n }, (_, i) => [prefijo ? id(prefijo, desde + i) : '', ...Array.from({ length: columnas - 1 }, () => '')]);

function Cartas({ c }: { c: Contenido }) {
  return (
    <>
      {(['PO', 'SD', 'SD2', 'AN', 'QA'] as const).map((r) => {
        const carta = c.cartas[r];
        return (
          <Pagina key={r} titulo={`Carta de ${c.roles[r]?.etiqueta ?? r}`} subtitulo="Carta secreta: no la muestres; lo que sabes se cuenta hablando.">
            <h3>Quién eres</h3><p>{carta.quienEres}</p>
            <h3>Lo que vienes a pedir</h3><ul>{carta.vienesAPedir.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>Lo que das por hecho</h3><ul>{carta.dasPorHecho.map((x) => <li key={x}>{x}</li>)}</ul>
            {carta.comoHablas && <><h3>Cómo hablas</h3><p>{carta.comoHablas}</p></>}
          </Pagina>
        );
      })}
    </>
  );
}

function Hojas({ c }: { c: Contenido }) {
  return (
    <>
      {(['FR', 'RT'] as const).map((r) => (
        <Pagina key={r} titulo={`Hoja de ${c.roles[r]?.nombre ?? r} (${r})`}>
          <p style={{ whiteSpace: 'pre-line' }}>{c.hojas[r].texto}</p>
        </Pagina>
      ))}
    </>
  );
}

function Plantillas({ c }: { c: Contenido }) {
  const p = c.plantillas;
  const canvas: [string, string][] = [
    ['Proyecto', p.canvas.proyecto], ['Objetivo', p.canvas.objetivo], ['Alcance', p.canvas.alcance], ['Restricciones', p.canvas.restricciones],
    ['Agenda', p.canvas.agenda], ['Formato', p.canvas.formato], ['Insumos', p.canvas.insumos], ['Participación', p.canvas.participacion],
    ['Riesgos', p.canvas.riesgos], ['Fecha del encuentro 1', p.canvas.fechaE1], ['Fecha del encuentro 2', p.canvas.fechaE2],
  ];
  const items = c.rondas.flatMap((r) => r.items.map((i) => ({ ...i, ronda: r.numero })));
  return (
    <>
      <Pagina titulo="01 · Canvas del ciclo">
        <Tabla columnas={['Campo', 'Contenido']} filas={canvas.map(([a, b]) => [a, b])} />
        <h3>Apertura · A4</h3>
        <Tabla
          columnas={['Perfil crítico', 'Persona y su reformulación (problema, alcance y resultado esperado)', '¿Equivalente?']}
          filas={[['Quien aporta la necesidad (SD · Paco)', '', 'Sí / No'], ['Quien especifica o construye (AN)', '', 'Sí / No'], ['Quien acepta (PO · Lucía)', '', 'Sí / No'], ['Ajustes acordados', '', '']]}
        />
      </Pagina>
      <Pagina titulo="02 · Mapa de stakeholders">
        <Tabla columnas={['Actor', 'Rol', 'Qué aporta', '¿Hace la tarea?', '¿Decide?', 'Disponibilidad']} filas={p.mapa.map((a) => [a.actor, a.rol, a.aporta, a.haceLaTarea, a.decide, a.disponibilidad])} />
        <p>Chequeo de suficiencia: {p.chequeoSuficiencia.respuesta}. {p.chequeoSuficiencia.detalle}</p>
      </Pagina>
      <Pagina titulo="03 · Declaración del problema y glosario vivo">
        <p><b>Problema:</b> {p.declaracion.enunciado}</p>
        <p><b>Afecta a:</b> {p.declaracion.afectados}</p>
        <Tabla
          columnas={['ID', 'Término', 'Definición acordada', 'Ejemplo', '¿Crítico?', 'Estado', 'Responsable']}
          filas={[
            ...p.glosario.map((t, i) => [id('T', i + 1), t.termino, t.definicion, t.ejemplo, t.critico, t.estado, '']),
            ...vacias(12 - p.glosario.length, 7, 'T', p.glosario.length + 1),
          ]}
        />
      </Pagina>
      <Pagina titulo="04 · Registro de necesidades y supuestos">
        <Tabla columnas={['ID', 'Bloque', 'Necesidad', 'Fuente', 'Contexto y valor', 'Supuestos', 'Prioridad', 'Estado']} filas={vacias(12, 8, 'N')} />
      </Pagina>
      <Pagina titulo="05 · Tarjetas de requisito">
        <Tabla columnas={['ID', 'Necesidad de origen', 'Tipo', 'Enunciado del requisito', '¿Crítico?', 'Criterio de aceptación y ejemplo', 'Prioridad', 'Restricción']} filas={vacias(8, 8, 'R')} />
      </Pagina>
      <Pagina titulo="I3 · Guía de micro-chequeos">
        <Tabla
          columnas={['Ronda', 'Término', 'Técnica', 'Pregunta', 'Quiénes y qué se acordó', 'Resultado', 'ID en 06']}
          filas={items.map((i) => [String(i.ronda), i.termino, i.tecnica, i.pregunta, '', 'Alineado / Divergencia / Pendiente', ''])}
        />
        <h3>Cierre de bloque</h3>
        <Tabla columnas={['Ítem', 'Sí / No / Pendiente', 'Observación']} filas={[['5 · Términos nuevos acordados (y comprobados, si son críticos)', '', ''], ['6 · Críticos con necesidad y quién la aportó', '', '']]} />
      </Pagina>
      <Pagina titulo="I2 · Lista de calidad y aceptación">
        <h3>Parte A · calidad de cada requisito (A5.2)</h3>
        <Tabla columnas={['ID', 'Revisión A1–A4 (Cumple / Corregir / Pendiente)', 'Si no cumple: ítem que falla y qué corregir']} filas={vacias(8, 3, 'R')} />
        <h3>Parte B · calidad del conjunto (A5.3)</h3>
        <Tabla columnas={['Ítem', 'Resultado', 'Observación']} filas={[['B1 · Sin duplicados ni redundancias', '', ''], ['B2 · Sin contradicciones', '', '']]} />
        <h3>Parte C · validación de los críticos (A5.3)</h3>
        <Tabla columnas={['ID crítico', 'C1 ¿Expresa su necesidad?', 'C2 ¿Confirma ejemplo y criterio?', 'C3 ¿Interpretan igual SD y QA?', 'ID en 06', 'Resultado que espera, en palabras del cliente']} filas={vacias(4, 6)} />
      </Pagina>
      <Pagina titulo="06 · Registro de validación y decisiones">
        <Tabla
          columnas={['Campo', 'Contenido']}
          filas={[['Conjunto validado', ''], ['Fecha y participantes', ''], ['Técnica usada', ''], ['Conformidad (firma, verbal o acta)', ''], ['Constancia', '']]}
        />
        <Tabla columnas={['ID', 'Detectada en', 'Afecta a', 'Divergencia: quién entiende qué', 'Resolución', 'Estado', 'Responsable', 'Fecha límite']} filas={vacias(10, 8, 'D')} />
      </Pagina>
      <Pagina titulo="07 · Línea base y cierre, con las evidencias E1–E5 (I1)">
        <Tabla
          columnas={['Evidencia', 'Sí / No / Pendiente', 'Observación']}
          filas={['E1 · Problema compartido', 'E2 · Vocabulario compartido', 'E3 · Críticos interpretados igual', 'E4 · Divergencias explícitas', 'E5 · Entendimiento transferible'].map((e) => [e, '', ''])}
        />
        <h3>Prueba de traspaso (E5)</h3>
        <Tabla columnas={['Requisito crítico', 'Quién reconstruye y qué entendió', '¿El PO confirma que coincide?', 'Si no coincide: qué se corrigió']} filas={vacias(3, 4)} />
        <h3>Otras acciones</h3>
        <Tabla columnas={['Origen', 'Acción', 'Responsable', 'Fecha']} filas={vacias(4, 4)} />
      </Pagina>
    </>
  );
}

function MedicionImpresa({ c }: { c: Contenido }) {
  return (
    <>
      {['Medición previa', 'Medición posterior'].map((titulo) => (
        <Pagina key={titulo} titulo={titulo} subtitulo="Responde solo. No escribas tu nombre. Mesa: ____   Rol: ____">
          {c.medicion.map((m, i) => (
            <div key={m.id}>
              <h3>Pregunta {i + 1}</h3>
              <p>{m.pregunta}</p>
              <p>____________________________________________________________</p>
            </div>
          ))}
        </Pagina>
      ))}
    </>
  );
}

function CuestionarioImpreso({ c }: { c: Contenido }) {
  const pasos = Array.from({ length: 21 }, (_, i) => i * 5);
  return (
    <Pagina titulo="Cuestionario" subtitulo="No escribas tu nombre. Mesa: ____   Rol: ____">
      <h3>¿Qué tan de acuerdo estás? (1 nada de acuerdo · 5 totalmente de acuerdo)</h3>
      <Tabla columnas={['Afirmación', '1', '2', '3', '4', '5']} filas={c.cuestionario.afirmaciones.map((a) => [a, '', '', '', '', ''])} />
      <h3>¿Cuánto te exigió la actividad? Marca una casilla (de 0 a 100, de 5 en 5)</h3>
      {c.cuestionario.tlx.map((t) => (
        <div key={t.id}>
          <p><b>{t.nombre}.</b> {t.descripcion}</p>
          <table><tbody><tr>{pasos.map((n) => <td key={n} style={{ fontSize: 9, textAlign: 'center', height: 22 }}>{n % 25 === 0 ? n : ''}</td>)}</tr></tbody></table>
          <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{t.bajo}</span><span>{t.alto}</span></p>
        </div>
      ))}
      <h3>{c.cuestionario.abierta}</h3>
      <p>____________________________________________________________</p>
      <p>____________________________________________________________</p>
    </Pagina>
  );
}

function QrImpreso({ d }: { d: Datos }) {
  if (!d.sesion) return <p className="error">Abre esta página desde la vista de los autores con una sesión elegida.</p>;
  return (
    <Pagina titulo={`Tomatera · sesión ${d.sesion.codigo}`} subtitulo="Escanea para unirte">
      <div style={{ maxWidth: 420 }}><Qr texto={d.sesion.enlace} etiqueta={`Código QR de la sesión ${d.sesion.codigo}`} /></div>
      <p style={{ fontSize: 22 }}>{d.sesion.enlace}</p>
      <p style={{ fontSize: 40, fontWeight: 800 }}>Código: {d.sesion.codigo}</p>
    </Pagina>
  );
}

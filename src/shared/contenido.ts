import { z } from 'zod';
import { LineCounter, parseDocument, type Document } from 'yaml';
import {
  COSTO, ESTADO_TERMINO, IMPLICITO, PRIORIDAD, RESULTADO_I3, ROLES, ROLES_MAPA, SI_NO, SI_NO_PEND,
  TECNICA_I3, TRAMOS,
} from './valores.js';

const texto = z.string().trim().min(1, 'No puede estar vacío');
const CLAVE_DESCONOCIDA = 'Clave no reconocida; si el texto tiene comas, ponlo entre comillas';
const obj = <T extends z.ZodRawShape>(forma: T) => z.object(forma).strict(CLAVE_DESCONOCIDA);
const rol = z.enum(ROLES);

const carta = obj({
  quienEres: texto,
  vienesAPedir: z.array(texto).min(1),
  dasPorHecho: z.array(texto).min(1),
  comoHablas: texto.optional(),
});

const tramo = obj({
  id: z.enum(TRAMOS),
  nombre: texto,
  minutos: z.number().int().positive(),
  paraTodos: texto,
  porRol: z.record(rol, texto).default({}),
});

const esquemaBase = obj({
  caso: obj({ nombre: texto, empresa: texto, equipo: texto }),
  fichaTecnica: obj({ titulo: texto, url: z.string().url() }),
  consentimiento: texto,
  roles: z.record(rol, obj({ nombre: texto, etiqueta: texto, color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })),
  cartas: obj({ PO: carta, SD: carta, SD2: carta, AN: carta, QA: carta }),
  hojas: obj({ FR: obj({ texto }), RT: obj({ texto }) }),
  agenda: z.array(tramo).length(TRAMOS.length),
  hitos: z.array(obj({ id: texto, tramo: z.enum(TRAMOS), minuto: z.number().nonnegative() })),
  avance: obj({ automatico: z.boolean(), graciaSegundos: z.number().int().nonnegative() }),
  plantillas: obj({
    canvas: obj({
      proyecto: texto, objetivo: texto, alcance: texto, restricciones: texto, agenda: texto, formato: texto,
      insumos: texto, participacion: texto, riesgos: texto, fechaE1: texto, fechaE2: texto,
      implicito: z.enum(IMPLICITO), malentendido: z.enum(COSTO), extensiones: texto,
    }),
    mapa: z.array(obj({
      actor: texto, rol: z.enum(ROLES_MAPA), aporta: z.string(), haceLaTarea: z.string(), decide: z.string(),
      disponibilidad: z.string(),
    })).min(1),
    chequeoSuficiencia: obj({ respuesta: z.enum(SI_NO), detalle: z.string() }),
    declaracion: obj({ enunciado: texto, afectados: texto, contraste: texto }),
    glosario: z.array(obj({
      termino: texto, definicion: texto, ejemplo: z.string().default(''), critico: z.enum(SI_NO),
      estado: z.enum(ESTADO_TERMINO),
    })).min(1),
  }),
  rondas: z.array(obj({
    numero: z.union([z.literal(1), z.literal(2)]),
    items: z.array(obj({ id: texto, termino: texto, tecnica: z.enum(TECNICA_I3), pregunta: texto })).min(1),
  })).length(2),
  medicion: z.array(obj({ id: texto, pregunta: texto, tipo: z.enum(['texto', 'numero']) })).length(4),
  cuestionario: obj({
    afirmaciones: z.array(texto).length(5),
    tlx: z.array(obj({ id: texto, nombre: texto, descripcion: texto, bajo: texto, alto: texto })).length(6),
    abierta: texto,
  }),
  entrevista: z.array(texto).length(3),
  destape: z.array(obj({ id: z.string().regex(/^T[1-8]$/), titulo: texto, detalle: texto })).length(8),
  bots: obj({
    versiones: obj({ PO: texto, SD: texto, AN: texto }),
    medicion: obj({
      previa: z.record(rol, z.array(z.string()).length(4)),
      posterior: z.array(z.string()).length(4),
    }),
    rondas: z.record(z.string(), z.record(rol, texto)),
    marcas: z.record(z.string(), z.enum(RESULTADO_I3)),
    necesidades: z.array(obj({
      necesidad: texto, fuente: z.enum(['PO', 'SD']), supuestos: z.string(), prioridad: z.enum(PRIORIDAD),
    })).min(1),
    tarjetas: z.array(obj({
      necesidad: z.number().int().nonnegative(), enunciado: texto, criterioEjemplo: texto, critico: z.enum(SI_NO),
    })).min(1),
    i2c: obj({ C1: z.enum(SI_NO_PEND), C2: z.enum(SI_NO_PEND), C3: z.enum(SI_NO_PEND) }),
    esperado: texto,
    traspaso: obj({ reconstruccion: texto, coincide: z.enum(SI_NO) }),
  }),
});

export const esquemaContenido = esquemaBase.superRefine((c, ctx) => {
  const ids = c.agenda.map((t) => t.id);
  if (ids.join() !== TRAMOS.join()) {
    ctx.addIssue({ code: 'custom', path: ['agenda'], message: `La agenda debe tener los tramos en este orden: ${TRAMOS.join(', ')}` });
  }
  const suma = c.agenda.reduce((s, t) => s + t.minutos, 0);
  if (suma !== 60) {
    ctx.addIssue({ code: 'custom', path: ['agenda'], message: `La agenda suma ${suma} minutos; debe sumar 60` });
  }
  for (const r of ROLES) {
    if (!c.roles[r]) ctx.addIssue({ code: 'custom', path: ['roles', r], message: `Falta el rol ${r}` });
  }
  const terminos = new Set(c.plantillas.glosario.map((g) => g.termino));
  c.rondas.forEach((ronda, i) => {
    ronda.items.forEach((item, j) => {
      if (!terminos.has(item.termino)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rondas', i, 'items', j, 'termino'],
          message: `El término «${item.termino}» de la ronda ${ronda.numero} no está en el glosario semilla`,
        });
      }
    });
  });
});

export type Contenido = z.infer<typeof esquemaContenido>;

export class ErrorContenido extends Error {
  constructor(message: string, public ruta: string, public linea?: number) {
    super(message);
    this.name = 'ErrorContenido';
  }
}

function lineaDe(doc: Document, lc: LineCounter, ruta: (string | number)[]): number | undefined {
  for (let n = ruta.length; n >= 0; n--) {
    const nodo = doc.getIn(ruta.slice(0, n), true) as { range?: [number, number, number] } | undefined;
    if (nodo && nodo.range) return lc.linePos(nodo.range[0]).line;
  }
  return undefined;
}

export function cargarContenido(textoYaml: string): Contenido {
  const lc = new LineCounter();
  const doc = parseDocument(textoYaml, { lineCounter: lc, prettyErrors: false });
  if (doc.errors.length > 0) {
    const err = doc.errors[0];
    const linea = err.linePos?.[0]?.line ?? lc.linePos(err.pos[0]).line;
    throw new ErrorContenido(`El archivo de contenido no es YAML válido (línea ${linea}): ${err.message}`, '', linea);
  }
  const resultado = esquemaContenido.safeParse(doc.toJS());
  if (!resultado.success) {
    const issue = resultado.error.issues[0];
    const ruta = issue.path.join('.');
    const linea = lineaDe(doc, lc, issue.path);
    const donde = linea ? ` (línea ${linea})` : '';
    throw new ErrorContenido(`Contenido inválido en «${ruta}»${donde}: ${issue.message}`, ruta, linea);
  }
  return resultado.data;
}

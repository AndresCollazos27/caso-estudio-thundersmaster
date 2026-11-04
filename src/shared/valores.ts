// Listas de valores copiadas tal cual de las validaciones del libro de la versión final
// (THUNDERS-Master_v1.6_plantillas_e_instrumentos.xlsx). La exportación depende de que coincidan.

export const SI_NO = ['Sí', 'No'] as const;
export const SI_NO_PEND = ['Sí', 'No', 'Pendiente'] as const;
export const IMPLICITO = ['Alto', 'Bajo'] as const;
export const COSTO = ['Barato', 'Caro'] as const;
export const ROLES_MAPA = ['FR', 'AN', 'RT', 'SD', 'PO', 'QA', 'Otro', 'No convocado', 'Fuente no humana'] as const;
export const ESTADO_TERMINO = ['Tentativo', 'Acordado', 'Acordado y comprobado', 'En divergencia'] as const;
export const PRIORIDAD = ['Alta', 'Media', 'Baja'] as const;
export const ESTADO_NECESIDAD = ['Nueva', 'Duplicada', 'En conflicto', 'Fuera de alcance'] as const;
export const TIPO_REQUISITO = ['Funcional', 'Calidad', 'Restricción'] as const;
export const CONFORMIDAD = ['Firma', 'Verbal', 'Acta'] as const;
export const DETECTADA_EN = [
  'A4 apertura',
  'I3 paráfrasis cruzada',
  'I3 sondeo de ambigüedad',
  'I3 ejemplo concreto',
  'I3 sistema de referencia',
  'I2 aceptación',
  'Prueba de traspaso',
  'Paquete de cierre',
  'Otra',
] as const;
export const ESTADO_DIVERGENCIA = ['Resuelta y confirmada', 'Pendiente', 'No crítica: cierra por objeción'] as const;
export const REVISION_I2A = ['Cumple', 'Corregir', 'Pendiente'] as const;
export const TECNICA_I3 = ['Paráfrasis cruzada', 'Sondeo de ambigüedad', 'Ejemplo concreto', 'Sistema de referencia'] as const;
export const RESULTADO_I3 = ['Alineado', 'Divergencia', 'Pendiente'] as const;

// Propios de la app: SD2 es Carmen, el segundo stakeholder de dominio.
export const ROLES = ['PO', 'SD', 'SD2', 'FR', 'AN', 'QA', 'RT'] as const;
export const TRAMOS = [
  'explicacion',
  'lectura',
  'medicion_previa',
  'a4',
  'a51',
  'a52',
  'a53',
  'a6',
  'medicion_posterior',
  'destape',
] as const;

export const MAX_TEXTO = 600;

export type SiNo = (typeof SI_NO)[number];
export type SiNoPend = (typeof SI_NO_PEND)[number];
export type Implicito = (typeof IMPLICITO)[number];
export type Costo = (typeof COSTO)[number];
export type RolMapa = (typeof ROLES_MAPA)[number];
export type EstadoTermino = (typeof ESTADO_TERMINO)[number];
export type Prioridad = (typeof PRIORIDAD)[number];
export type EstadoNecesidad = (typeof ESTADO_NECESIDAD)[number];
export type TipoRequisito = (typeof TIPO_REQUISITO)[number];
export type Conformidad = (typeof CONFORMIDAD)[number];
export type DetectadaEn = (typeof DETECTADA_EN)[number];
export type EstadoDivergencia = (typeof ESTADO_DIVERGENCIA)[number];
export type RevisionI2A = (typeof REVISION_I2A)[number];
export type TecnicaI3 = (typeof TECNICA_I3)[number];
export type ResultadoI3 = (typeof RESULTADO_I3)[number];
export type Rol = (typeof ROLES)[number];
export type TramoId = (typeof TRAMOS)[number];

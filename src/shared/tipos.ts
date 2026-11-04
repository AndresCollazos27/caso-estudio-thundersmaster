import type { Contenido } from './contenido.js';
import type {
  Conformidad, DetectadaEn, EstadoDivergencia, EstadoNecesidad, EstadoTermino, Prioridad, ResultadoI3, RevisionI2A,
  Rol, SiNo, SiNoPend, TecnicaI3, TipoRequisito, TramoId,
} from './valores.js';

export interface Termino {
  id: string;
  termino: string;
  definicion: string;
  ejemplo: string;
  critico: SiNo;
  estado: EstadoTermino;
  responsable: string;
  editadoPor: string;
}

export interface Necesidad {
  id: string;
  bloque: number;
  necesidad: string;
  fuente: string;
  contextoValor: string;
  supuestos: string;
  prioridad?: Prioridad;
  estado: EstadoNecesidad;
  editadoPor: string;
}

export interface Tarjeta {
  id: string;
  necesidadId: string;
  tipo: TipoRequisito;
  enunciado: string;
  critico: SiNo;
  criterioEjemplo: string;
  prioridad?: Prioridad;
  restriccion: string;
  acepta: string;
  editadoPor: string;
}

export interface FilaI2C {
  C1?: SiNoPend;
  C2?: SiNoPend;
  C3?: SiNoPend;
  esperado: string;
  divergenciaId?: string;
}

export interface Divergencia {
  id: string;
  detectadaEn: DetectadaEn;
  afectaA: string;
  descripcion: string;
  resolucion: string;
  estado?: EstadoDivergencia;
  responsable: string;
  fechaLimite: string;
  creadaPor: string;
}

export interface ResultadoRonda {
  resultado: ResultadoI3;
  divergenciaId?: string;
  marcadoPor: string;
}

export interface ItemRonda {
  id: string;
  termino: string;
  tecnica: TecnicaI3;
  pregunta: string;
}

export interface Ronda {
  numero: 1 | 2;
  lanzadaEn: number;
  items: ItemRonda[];
  respuestas: Record<string, Record<string, string>>;
  reveladaEn?: number;
  resultados: Record<string, ResultadoRonda>;
}

export type PerfilApertura = 'PO' | 'SD' | 'AN';
export type Evidencia = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export interface Mesa {
  numero: number;
  miembros: Record<string, Rol[]>;
  apertura: {
    versiones: Partial<Record<PerfilApertura, { texto: string; por: string; en: number }>>;
    equivalencia: Partial<Record<PerfilApertura, SiNo>>;
    ajustes: string;
  };
  glosario: Termino[];
  necesidades: Necesidad[];
  tarjetas: Tarjeta[];
  i2a: Record<string, { revision: RevisionI2A; nota: string }>;
  i2b: { B1?: SiNoPend; B2?: SiNoPend; obsB1: string; obsB2: string };
  i2c: Record<string, FilaI2C>;
  esperadosPorNecesidad: Record<string, string>;
  planI3: { numero: 1 | 2; items: ItemRonda[] }[];
  rondas: Ronda[];
  chequeosBloque: { c5?: SiNoPend; c6?: SiNoPend; obs: string };
  validacion06: { conjunto: string; fechaParticipantes: string; tecnica: string; conformidad?: Conformidad; constancia: string };
  divergencias: Divergencia[];
  lineaBase: {
    congeladaEn?: number;
    congeladaPor?: string;
    instantanea?: { tarjetas: Tarjeta[]; glosario: Termino[] };
    evidencias: Partial<Record<Evidencia, { resultado: SiNoPend; nota: string }>>;
  };
  traspaso: {
    lectorId?: string;
    lectorMesa?: number;
    items: Record<string, { reconstruccion: string; coincide?: SiNo; correccion: string }>;
  };
  acciones: { origen: string; accion: string; responsable: string; fecha: string }[];
  destape: Record<string, boolean>;
  fichaPedidas: { por: string; en: number }[];
  reabiertos: TramoId[];
}

export interface Participante {
  id: string;
  apodo?: string;
  mesa: number | null;
  roles: Rol[];
  espectador: boolean;
  bot: boolean;
  conectado: boolean;
  unidoEn: number;
  cartaLeida: boolean;
  // Secreto para volver a entrar desde el celular; solo lo conoce ese celular y el servidor.
  clave?: string;
}

export type EstadoSesion = 'inscripcion' | 'en_curso' | 'cerrada' | 'terminada';

export interface EstadoDeSesion {
  id: string;
  codigo: string;
  prueba: boolean;
  velocidad: number;
  contenido: Contenido;
  creadaEn: number;
  estado: EstadoSesion;
  tramoIndice: number | null;
  tramoInicio: number | null;
  pausadaEn: number | null;
  pausaAcumulada: number;
  avanceAutomatico: boolean;
  hitosHechos: string[];
  participantes: Record<string, Participante>;
  llegadas: string[];
  mesas: Record<number, Mesa>;
  medicion: Record<string, { previa?: string[]; posterior?: string[] }>;
  cuestionario: Record<string, { afirmaciones: number[]; tlx: number[]; abierta: string }>;
  entrevista: { pregunta: number; texto: string }[];
  ultimoSeq: number;
}

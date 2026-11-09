import type { Contenido } from './contenido.js';
import type { Rol } from './valores.js';

// Los nombres de los roles en la versión final de THUNDERS Master. Los estudiantes no conocen las siglas.
const NOMBRES: Record<Rol, string> = {
  PO: 'Responsable de decisión',
  SD: 'Stakeholder de dominio',
  SD2: 'Stakeholder de dominio',
  FR: 'Facilitador de requisitos',
  AN: 'Analista o especificador',
  QA: 'Responsable de calidad',
  RT: 'Relator o gestor de trazabilidad',
};

// En una frase basta la forma corta: «el facilitador», «el relator».
const EN_TEXTO: Record<Rol, string> = {
  PO: 'responsable de decisión',
  SD: 'stakeholder de dominio',
  SD2: 'stakeholder de dominio',
  FR: 'facilitador',
  AN: 'analista',
  QA: 'responsable de calidad',
  RT: 'relator',
};

export const nombreRol = (rol: string): string => NOMBRES[rol as Rol] ?? rol;

// Para textos que todavía traen siglas, como el contenido guardado en sesiones anteriores o un mensaje del servidor.
export const textoRoles = (texto: string): string =>
  texto.replace(/\b(SD2|PO|SD|FR|AN|QA|RT)\b/g, (sigla, _s, pos: number, todo: string) => {
    const nombre = EN_TEXTO[sigla as Rol];
    const alInicio = pos === 0 || /[.!?¿¡]\s*$/.test(todo.slice(0, pos));
    return alInicio ? nombre[0].toUpperCase() + nombre.slice(1) : nombre;
  });

export function etiquetaRol(roles: Contenido['roles'], rol: Rol): string {
  const nombre = nombreRol(rol);
  if (!['PO', 'SD', 'SD2'].includes(rol)) return nombre;
  const persona = roles[rol]?.nombre.split(' ')[0];
  return persona ? `${nombre} · ${persona}` : nombre;
}

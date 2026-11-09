import { puedeRol } from '../../src/shared/permisos.js';
import { etiquetaRol, nombreRol, textoRoles } from '../../src/shared/roles.js';
import { ROLES, type Rol, type TramoId } from '../../src/shared/valores.js';
import { contenidoReal } from '../fixtures/contenido.js';

describe('nombres de rol de la versión final', () => {
  it('nombreRol da el nombre que el rol tiene en THUNDERS Master', () => {
    expect((['PO', 'SD', 'SD2', 'FR', 'AN', 'QA', 'RT'] as const).map(nombreRol)).toEqual([
      'Responsable de decisión', 'Stakeholder de dominio', 'Stakeholder de dominio', 'Facilitador de requisitos',
      'Analista o especificador', 'Responsable de calidad', 'Relator o gestor de trazabilidad',
    ]);
  });

  it('etiquetaRol suma el personaje solo en los roles del cliente', () => {
    const roles = contenidoReal().roles;
    expect(etiquetaRol(roles, 'PO')).toBe('Responsable de decisión · Lucía');
    expect(etiquetaRol(roles, 'SD')).toBe('Stakeholder de dominio · Paco');
    expect(etiquetaRol(roles, 'SD2')).toBe('Stakeholder de dominio · Carmen');
    expect(etiquetaRol(roles, 'QA')).toBe('Responsable de calidad');
    expect(etiquetaRol({}, 'RT')).toBe('Relator o gestor de trazabilidad');
  });

  it('textoRoles cambia las siglas sueltas por el nombre del rol en el texto corrido', () => {
    expect(textoRoles('Si el FR marca que no, el RT lo anota.')).toBe('Si el facilitador marca que no, el relator lo anota.');
    expect(textoRoles('Para el AN y el QA')).toBe('Para el analista y el responsable de calidad');
    expect(textoRoles('PO')).toBe('Responsable de decisión');
    expect(textoRoles('SD2: Carmen. QA: nadie')).toBe('Stakeholder de dominio: Carmen. Responsable de calidad: nadie');
    expect(textoRoles('ANTES, POCO, Paco y QAs')).toBe('ANTES, POCO, Paco y QAs');
  });
});

describe('glosario vivo', () => {
  const contexto = (tramo: TramoId) => ({ estado: 'en_curso' as const, tramo, reabiertos: [] as TramoId[] });

  it('toda la mesa puede agregar palabras al glosario durante el ciclo, de la apertura al cierre', () => {
    for (const rol of ROLES as readonly Rol[]) {
      for (const tramo of ['a4', 'a51', 'a52', 'a53', 'a6'] as const) {
        expect(puedeRol('guardarTermino', [rol], contexto(tramo)).ok).toBe(true);
      }
    }
  });

  it('fuera del ciclo nadie edita el glosario', () => {
    for (const tramo of ['lectura', 'medicion_previa', 'medicion_posterior', 'destape'] as const) {
      expect(puedeRol('guardarTermino', ['RT'], contexto(tramo)).ok).toBe(false);
    }
  });
});

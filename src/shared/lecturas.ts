// Lecturas automáticas: las mismas reglas y los mismos textos que las fórmulas del libro de la versión final.
import type { Divergencia, Evidencia, FilaI2C, Mesa, Tarjeta } from './tipos.js';
import type { Rol, SiNoPend } from './valores.js';

export type Lectura = { valor: SiNoPend; texto: string };
export type ResultadoI2C = 'Divergencia → 06' | 'Aceptado' | 'Por validar' | 'Pendiente';

const EVIDENCIAS: Evidencia[] = ['E1', 'E2', 'E3', 'E4', 'E5'];

const leer = (valor: SiNoPend, texto: string): Lectura => ({ valor, texto });

export function leerE1(m: Mesa): Lectura {
  const marcas = (['SD', 'AN', 'PO'] as const).map((p) => m.apertura.equivalencia[p]);
  if (marcas.some((x) => x === undefined)) return leer('Pendiente', 'Pendiente: faltan reformulaciones de los perfiles críticos');
  if (marcas.includes('No')) return leer('No', 'No: hay versiones no equivalentes (registre la divergencia en 06)');
  return leer('Sí', 'Sí: las versiones de los perfiles críticos son equivalentes');
}

export function leerE2(m: Mesa): Lectura {
  const criticos = m.glosario.filter((t) => t.critico === 'Sí' && t.termino.trim() !== '');
  if (criticos.length === 0) return leer('Pendiente', 'Pendiente: no hay términos críticos marcados');
  const sinAcordar = criticos.filter((t) => t.estado !== 'Acordado' && t.estado !== 'Acordado y comprobado').length;
  if (sinAcordar > 0) {
    return leer('No', `No: ${sinAcordar} término(s) crítico(s) sin definición acordada (registre la divergencia en 06)`);
  }
  const comprobados = criticos.filter((t) => t.estado === 'Acordado y comprobado').length;
  if (comprobados === 0) return leer('Pendiente', 'Pendiente: ningún término crítico se comprobó entre perfiles distintos');
  return leer('Sí', `Sí: ${criticos.length} término(s) crítico(s) acordados; ${comprobados} comprobados entre perfiles`);
}

export function resultadoFilaI2C(f: FilaI2C): ResultadoI2C {
  const respuestas = [f.C1, f.C2, f.C3];
  if (respuestas.includes('No')) return 'Divergencia → 06';
  const conEsperado = f.esperado.trim() !== '';
  if (respuestas.every((r) => r === 'Sí') && conEsperado) return 'Aceptado';
  if (respuestas.every((r) => r === undefined) && !conEsperado) return 'Por validar';
  return 'Pendiente';
}

// La mesa cuya línea base lee esta persona en el traspaso: lee quien tenga ahora el QA de la mesa lectora,
// así que si los autores pasan el rol a otra persona, el traspaso sigue.
export function mesaQueLee(mesas: Record<number, Mesa>, p: { mesa: number | null; roles: Rol[] }): Mesa | undefined {
  if (p.mesa === null || !p.roles.includes('QA')) return undefined;
  return Object.values(mesas).find((m) => m.traspaso.lectorMesa === p.mesa);
}

export function tarjetasCriticas(tarjetas: Tarjeta[]): Tarjeta[] {
  return tarjetas.filter((t) => t.critico === 'Sí' && t.enunciado.trim() !== '');
}

// La columna H sale de lo que el cliente escribió en A5.2 para la necesidad de origen,
// salvo que la fila ya tenga su propio texto.
export function filaI2C(m: Mesa, id: string): FilaI2C {
  const fila = m.i2c[id] ?? { esperado: '' };
  if (fila.esperado.trim() !== '') return fila;
  const tarjeta = m.tarjetas.find((t) => t.id === id);
  const porNecesidad = tarjeta ? m.esperadosPorNecesidad[tarjeta.necesidadId] ?? '' : '';
  return { ...fila, esperado: porNecesidad };
}

export function leerE3(m: Mesa): Lectura {
  const criticas = tarjetasCriticas(m.tarjetas);
  const n = criticas.length;
  if (n === 0) return leer('Pendiente', 'Pendiente: no hay requisitos críticos marcados en 05');
  const resultados = criticas.map((t) => resultadoFilaI2C(filaI2C(m, t.id)));
  const conDivergencia = resultados.filter((r) => r === 'Divergencia → 06').length;
  if (conDivergencia > 0) return leer('No', `No: ${conDivergencia} crítico(s) con divergencia (ver 06)`);
  const aceptados = resultados.filter((r) => r === 'Aceptado').length;
  if (aceptados === n) return leer('Sí', `Sí: los ${n} críticos tienen ejemplo y criterio aceptados`);
  return leer('Pendiente', `Pendiente: ${aceptados} de ${n} críticos aceptados`);
}

export function esCritica(d: Divergencia, m: Mesa): boolean {
  if (d.afectaA.startsWith('R-')) {
    const t = m.tarjetas.find((x) => x.id === d.afectaA);
    return t ? t.critico === 'Sí' : true;
  }
  if (d.afectaA.startsWith('T-')) {
    const t = m.glosario.find((x) => x.id === d.afectaA);
    return t ? t.critico === 'Sí' : true;
  }
  return true;
}

export function divergenciasSinRegistrar(m: Mesa): number {
  let total = 0;
  for (const ronda of m.rondas) {
    for (const r of Object.values(ronda.resultados)) {
      if (r.resultado !== 'Alineado' && !r.divergenciaId) total++;
    }
  }
  for (const t of tarjetasCriticas(m.tarjetas)) {
    const fila = filaI2C(m, t.id);
    if (resultadoFilaI2C(fila) === 'Divergencia → 06' && !fila.divergenciaId) total++;
  }
  return total;
}

export function leerE4(m: Mesa): Lectura {
  const sinRegistrar = divergenciasSinRegistrar(m);
  if (sinRegistrar > 0) {
    return leer('Pendiente', `Pendiente: ${sinRegistrar} divergencia(s) detectada(s) en I3 o I2 sin registrar aquí`);
  }
  const registradas = m.divergencias.length;
  if (registradas === 0) return leer('Sí', 'Sí: no se registraron divergencias en el ciclo');
  const abiertas = m.divergencias.filter((d) => esCritica(d, m) && d.estado !== 'Resuelta y confirmada').length;
  if (abiertas > 0) return leer('Pendiente', `Pendiente: ${abiertas} divergencia(s) crítica(s) sin resolver y confirmar`);
  return leer('Sí', `Sí: ${registradas} divergencia(s) registradas; las críticas están resueltas y confirmadas`);
}

export function muestraTraspaso(criticos: number): number {
  if (criticos === 0) return 0;
  return Math.min(criticos, Math.max(2, Math.ceil(0.2 * criticos)));
}

export function leerE5(m: Mesa): Lectura {
  const criticos = tarjetasCriticas(m.lineaBase.instantanea?.tarjetas ?? m.tarjetas).length;
  if (criticos === 0) return leer('Pendiente', 'Pendiente: no hay críticos en la línea base');
  const items = Object.values(m.traspaso.items);
  if (items.some((i) => i.coincide === 'No')) {
    return leer('No', 'No: una reconstrucción no coincide; corrija la tarjeta o el paquete y repita');
  }
  const coinciden = items.filter((i) => i.coincide === 'Sí').length;
  const muestra = muestraTraspaso(criticos);
  if (coinciden >= muestra) return leer('Sí', `Sí: ${coinciden} de ${muestra} reconstrucciones coinciden`);
  return leer('Pendiente', `Pendiente: ${coinciden} de ${muestra} reconstrucciones confirmadas`);
}

export function estadoCiclo(m: Mesa): string {
  const enSi = EVIDENCIAS.filter((e) => m.lineaBase.evidencias[e]?.resultado === 'Sí').length;
  if (enSi === 5) return 'CERRADO: las cinco evidencias están en «Sí»';
  return `ABIERTO: ${5 - enSi} evidencia(s) sin «Sí». Un «No» abre una divergencia (06); un «Pendiente», una acción con responsable y fecha`;
}

export function leerB3(m: Mesa): Lectura {
  if (m.necesidades.length === 0) return leer('Pendiente', 'Pendiente: no hay necesidades en 04');
  const sinTarjeta = m.necesidades.filter(
    (n) => n.prioridad && n.estado !== 'Duplicada' && n.estado !== 'Fuera de alcance' && !m.tarjetas.some((t) => t.necesidadId === n.id),
  ).length;
  if (sinTarjeta > 0) return leer('No', `No: ${sinTarjeta} necesidad(es) priorizada(s) sin requisito (ver 04)`);
  return leer('Sí', 'Sí: toda necesidad priorizada tiene requisito');
}

export function contadorI3(m: Mesa): string {
  const planificados = m.planI3.reduce((s, r) => s + r.items.length, 0);
  const hechos = m.rondas.reduce((s, r) => s + Object.keys(r.resultados).length, 0);
  const minimo = Math.max(2, planificados);
  const estado = hechos >= minimo ? 'Cumple' : `faltan ${minimo - hechos}`;
  return `Puntos críticos planificados: ${planificados} · micro-chequeos hechos: ${hechos} · mínimo: ${minimo} → ${estado}`;
}

export interface LecturasMesa {
  E1: Lectura;
  E2: Lectura;
  E3: Lectura;
  E4: Lectura;
  E5: Lectura;
  B3: Lectura;
  ciclo: string;
  i3: string;
}

export function lecturasMesa(m: Mesa): LecturasMesa {
  return {
    E1: leerE1(m), E2: leerE2(m), E3: leerE3(m), E4: leerE4(m), E5: leerE5(m), B3: leerB3(m),
    ciclo: estadoCiclo(m), i3: contadorI3(m),
  };
}

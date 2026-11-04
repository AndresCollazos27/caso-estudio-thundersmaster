import type { Actor, EventoSinSeq, NumeroRonda } from '../shared/eventos.js';
import { ESPERA_RONDA_MS, hitosVencidos, restanteMs } from '../shared/tiempo.js';
import type { EstadoDeSesion, Mesa } from '../shared/tipos.js';
import { TRAMOS } from '../shared/valores.js';

const SISTEMA: Actor = { tipo: 'sistema' };

function quienTiene(m: Mesa, rol: 'QA'): string | null {
  return Object.keys(m.miembros).find((id) => m.miembros[id].includes(rol)) ?? null;
}

// Lo que el servidor hace solo con el paso del tiempo, aunque la pantalla de Leandro esté cerrada.
export function revisarReloj(estado: EstadoDeSesion, ahora: number): EventoSinSeq[] {
  if (estado.estado !== 'en_curso' || estado.pausadaEn !== null || estado.tramoIndice === null) return [];
  const ev = (tipo: EventoSinSeq['tipo'], datos: unknown, mesa?: number) =>
    ({ en: ahora, por: SISTEMA, tipo, datos, ...(mesa !== undefined ? { mesa } : {}) }) as EventoSinSeq;
  const eventos: EventoSinSeq[] = [];
  const mesas = Object.values(estado.mesas).sort((a, b) => a.numero - b.numero);

  for (const hito of hitosVencidos(estado.contenido, estado, ahora)) {
    if (hito === 'ronda1' || hito === 'ronda2') {
      const numero = Number(hito.slice(-1)) as NumeroRonda;
      if (!mesas.some((m) => m.rondas.some((r) => r.numero === numero))) eventos.push(ev('ronda.lanzada', { numero }));
    }
    if (hito === 'congelar') {
      for (const m of mesas) if (m.lineaBase.congeladaEn === undefined) eventos.push(ev('lineabase.congelada', { por: 'sistema' }, m.numero));
      if (mesas.length > 1) {
        mesas.forEach((m, i) => {
          const anterior = mesas[(i - 1 + mesas.length) % mesas.length];
          eventos.push(ev('traspaso.asignado', { lectorId: quienTiene(anterior, 'QA'), lectorMesa: anterior.numero }, m.numero));
        });
      }
    }
    eventos.push(ev('hito.hecho', { id: hito }));
  }

  // Una ronda se revela a los 60 s o al terminar A5.1, salvo en una mesa a la que los autores le reabrieron A5.1.
  const espera = ESPERA_RONDA_MS / estado.velocidad;
  const enA51 = TRAMOS[estado.tramoIndice] === 'a51';
  for (const m of mesas) {
    const sigueAbierta = enA51 || m.reabiertos.includes('a51');
    for (const r of m.rondas) {
      if (r.reveladaEn === undefined && (ahora - r.lanzadaEn >= espera || !sigueAbierta)) eventos.push(ev('ronda.revelada', { numero: r.numero }, m.numero));
    }
  }

  const gracia = (estado.contenido.avance.graciaSegundos * 1000) / estado.velocidad;
  if (estado.avanceAutomatico && restanteMs(estado.contenido, estado, ahora) <= -gracia) {
    const siguiente = estado.tramoIndice + 1;
    eventos.push(siguiente < TRAMOS.length ? ev('tramo.iniciado', { indice: siguiente }) : ev('sesion.cerrada', {}));
  }
  return eventos;
}

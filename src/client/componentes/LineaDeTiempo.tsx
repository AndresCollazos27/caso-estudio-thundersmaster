import type { CSSProperties } from 'react';
import type { TramoId } from '../../shared/valores.js';
import type { VistaSesion } from '../../shared/vistas.js';

// Colores de los bocetos: lectura, medición, encuentro con el cliente, trabajo sin el cliente y debate.
const CLASE: Record<TramoId, string> = {
  explicacion: 'l', lectura: 'l', medicion_previa: 'm', a4: 'e', a51: 'e', a52: 's', a53: 'e', a6: 'e', medicion_posterior: 'm', destape: 'd',
};

// Los 60 minutos del caso, con una marca en el minuto actual.
export function LineaDeTiempo({ s, minuto }: { s: VistaSesion; minuto: number }) {
  const total = s.agenda.reduce((x, t) => x + t.minutos, 0);
  return (
    <div className="linea" role="img" aria-label={`Minuto ${Math.floor(minuto)} de ${total}`}>
      {s.agenda.map((t) => (
        <span key={t.id} className={CLASE[t.id]} title={t.nombre} style={{ '--w': `${(t.minutos / total) * 100}%` } as CSSProperties} />
      ))}
      <i className="marca" style={{ left: `calc(${(minuto / total) * 100}% - var(--u) * .22)` }} />
    </div>
  );
}

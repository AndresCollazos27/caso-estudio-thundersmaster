import { useCallback, useMemo, useState } from 'react';
import type { VistaJugador } from '../../shared/vistas.js';
import { almacenLocal, conPrefijo, crearBorradores } from '../borradores.js';
import type { Conexion } from '../conexion.js';
import { Contexto, usarMesa, type Enviar } from '../contexto.js';
import { Ahora } from '../componentes/Ahora.js';
import { Apertura } from '../componentes/Apertura.js';
import { BarraMesa } from '../componentes/BarraMesa.js';
import { Carta } from '../componentes/Carta.js';
import { Capa, Mensajes, usarEnvio } from '../componentes/comunes.js';
import { Glosario } from '../componentes/Glosario.js';
import { ChequeosBloque } from '../componentes/ChequeosBloque.js';
import { Cuestionario } from '../componentes/Cuestionario.js';
import { Destape } from '../componentes/Destape.js';
import { Espectador } from '../componentes/Espectador.js';
import { LineaBase } from '../componentes/LineaBase.js';
import { Traspaso } from '../componentes/Traspaso.js';
import { Esperados } from '../componentes/Esperados.js';
import { I2ParteA, I2ParteB, I2ParteC } from '../componentes/I2.js';
import { Tarjetas } from '../componentes/Tarjetas.js';
import { Divergencias06, Validacion06 } from '../componentes/Validacion06.js';
import { Medicion } from '../componentes/Medicion.js';
import { Necesidades } from '../componentes/Necesidades.js';
import { Rondas } from '../componentes/Ronda.js';
import { ayudasVisibles, textoAhora, tiene } from '../textos.js';

type CapaAbierta = 'carta' | 'glosario' | 'ficha' | null;

export function Mesa({ v, con, conectado }: { v: VistaJugador; con: Conexion; conectado: boolean }) {
  const [capa, setCapa] = useState<CapaAbierta>(null);
  const borradores = useMemo(() => conPrefijo(crearBorradores(almacenLocal()), `${v.sesion.id}:${v.yo.id}:`), [v.sesion.id, v.yo.id]);
  const enviar = useCallback<Enviar>((tipo, datos) => con.enviar(tipo, datos), [con]);
  const ctx = useMemo(() => ({ v, enviar, borradores }), [v, enviar, borradores]);

  if (v.yo.espectador || v.mesa === null) {
    return (
      <div className="cel">
        <BarraMesa v={v} conectado={conectado} desfaseMs={con.desfaseMs()} />
        {v.yo.espectador
          ? <Espectador v={v} />
          : <main className="cuerpo"><Ahora textos={['Ya estás dentro. Espera a que Leandro arme las mesas; la pantalla dirá cuándo.']} /></main>}
      </div>
    );
  }

  const ayudas = ayudasVisibles(v);
  return (
    <Contexto.Provider value={ctx}>
      <div className="cel">
        <BarraMesa v={v} conectado={conectado} desfaseMs={con.desfaseMs()} />
        <main className="cuerpo">
          <p className="paso">{v.sesion.estado === 'cerrada' ? 'Cierre de la sesión' : v.sesion.nombreTramo}</p>
          <Ahora textos={textoAhora(v)} />
          <Tramo />
          {ayudas && (
            <nav className="enlaces" aria-label="Más">
              <button type="button" onClick={() => setCapa('carta')}>{v.carta ? 'Mi carta' : 'Mi hoja'}</button>
              <button type="button" onClick={() => setCapa('glosario')}>Glosario</button>
              <button type="button" onClick={() => setCapa('ficha')}>Ficha técnica</button>
            </nav>
          )}
        </main>
        {ayudas && capa === 'carta' && <Capa titulo={v.carta ? 'Mi carta' : 'Mi hoja'} onCerrar={() => setCapa(null)}><Carta /></Capa>}
        {ayudas && capa === 'glosario' && <Capa titulo="Glosario (03)" onCerrar={() => setCapa(null)}><Glosario /></Capa>}
        {ayudas && capa === 'ficha' && <Capa titulo="Ficha técnica" onCerrar={() => setCapa(null)}><FichaTecnica /></Capa>}
      </div>
    </Contexto.Provider>
  );
}

// Lo que toca escribir o marcar en este tramo, según el rol.
function Tramo() {
  const { v } = usarMesa();
  if (v.sesion.estado === 'cerrada') return <Cuestionario />;
  switch (v.sesion.tramo) {
    case 'lectura':
      return <Carta />;
    case 'medicion_previa':
    case 'medicion_posterior':
      return <Medicion />;
    case 'a4':
      return (
        <>
          <Apertura />
          {tiene(v, 'RT', 'FR') && <Divergencias06 />}
        </>
      );
    case 'a51':
      return (
        <>
          <Rondas />
          <Necesidades />
          {tiene(v, 'QA', 'RT') && (
            <>
              <h3 className="paso">Glosario (03)</h3>
              <Glosario />
            </>
          )}
          {tiene(v, 'FR') && <ChequeosBloque />}
          {tiene(v, 'RT') && <Divergencias06 />}
        </>
      );
    case 'a52':
      // El cliente vuelve a Madrid: no ve las tarjetas y escribe lo que espera.
      return (
        <>
          {tiene(v, 'PO', 'SD', 'SD2') ? <Esperados /> : <Tarjetas />}
          {tiene(v, 'QA', 'AN') && <I2ParteA />}
          {tiene(v, 'RT') && <Divergencias06 />}
        </>
      );
    case 'a53':
      return (
        <>
          <I2ParteC />
          <I2ParteB />
          {tiene(v, 'RT') && <Validacion06 />}
          {tiene(v, 'RT', 'FR') && <Divergencias06 />}
          <Tarjetas />
        </>
      );
    case 'a6':
      return (
        <>
          <Traspaso />
          <LineaBase />
          {tiene(v, 'RT', 'FR') && <Divergencias06 />}
        </>
      );
    case 'destape':
      return <Destape />;
    default:
      return null;
  }
}

// Pedirla queda registrado: es uno de los datos del estudio de caso.
function FichaTecnica() {
  const { v, enviar } = usarMesa();
  const envio = usarEnvio();
  if (v.fichaTecnica) {
    return (
      <div className="papel">
        <p>{v.fichaTecnica.titulo}</p>
        <a className="btn sec" href={v.fichaTecnica.url} target="_blank" rel="noopener noreferrer">Abrir el artículo</a>
        <p className="nota">Se abre en otra pestaña.</p>
      </div>
    );
  }
  return (
    <div className="papel">
      <p>Es el artículo en el que se basa Paco, el asesor de huerto. Si la pides, queda registrado que la pediste.</p>
      <button type="button" className="btn" disabled={envio.enviando} onClick={() => envio.correr(() => enviar('pedirFicha', {}), 'Listo')}>Pedir la ficha técnica</button>
      <Mensajes error={envio.error} />
    </div>
  );
}

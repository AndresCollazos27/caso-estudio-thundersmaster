import { useEffect, useId, useState } from 'react';
import type { Identidad } from '../identidad.js';

interface InfoSesion {
  caso: { nombre: string; empresa: string; equipo: string };
  consentimiento: string;
}

// Al escanear el QR: apodo opcional, consentimiento y «Unirme». Sin cuentas ni contraseñas.
export function Unirse({ codigoInicial, onUnido }: { codigoInicial: string; onUnido: (i: Identidad) => void }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [info, setInfo] = useState<InfoSesion | null>(null);
  const [apodo, setApodo] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idCodigo = useId();
  const idApodo = useId();

  useEffect(() => {
    if (!/^\d{6}$/.test(codigo)) {
      setInfo(null);
      return;
    }
    let vigente = true;
    fetch(`/api/sesion?c=${codigo}`)
      .then(async (r) => {
        const x = await r.json();
        if (!vigente) return;
        setInfo(r.ok ? x : null);
        setError(r.ok ? null : x.error ?? 'Código de sesión incorrecto');
      })
      .catch(() => vigente && setError('No se pudo conectar con el servidor; revisa el wifi'));
    return () => {
      vigente = false;
    };
  }, [codigo]);

  async function unirme() {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/unirse', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo, apodo: apodo.trim() || undefined, consentimiento: acepto }),
      });
      const x = await r.json();
      if (r.ok) onUnido({ sesionId: x.sesionId, participanteId: x.participanteId, clave: x.clave, codigo });
      else setError(x.error ?? 'No se pudo entrar');
    } catch {
      setError('No se pudo conectar con el servidor; revisa el wifi');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="cel">
      <div className="unirse">
        <p className="logo">Tomatera</p>
        {codigoInicial
          ? <p>Te vas a unir a la sesión <b className="mono">{codigoInicial}</b>.</p>
          : (
            <div className="campo">
              <label className="etq" htmlFor={idCodigo}>Código de la sesión</label>
              <input id={idCodigo} type="text" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
            </div>
          )}
        <div className="campo">
          <label className="etq" htmlFor={idApodo}>Un apodo (opcional; mejor que no sea tu nombre)</label>
          <input id={idApodo} type="text" maxLength={30} value={apodo} onChange={(e) => setApodo(e.target.value)} autoComplete="off" />
        </div>
        <div className="consent">
          <p>Participar es voluntario. Tus respuestas son anónimas y no afectan tu nota.</p>
          {info && <button type="button" className="enlace" style={{ justifySelf: 'start', padding: 0 }} onClick={() => setVerTexto(!verTexto)}>{verTexto ? 'Ocultar el consentimiento' : 'Leer el consentimiento'}</button>}
          {verTexto && info && <p className="nota">{info.consentimiento}</p>}
          <label className="casilla"><input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />Acepto participar</label>
        </div>
        <button type="button" className="btn" disabled={!info || !acepto || enviando} onClick={unirme}>{enviando ? 'Entrando…' : 'Unirme'}</button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="nota">Después, la pantalla te dirá tu mesa.</p>
      </div>
    </main>
  );
}

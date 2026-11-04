import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// El QR se genera en el navegador con el paquete qrcode: no se llama a ningún servicio externo.
export function Qr({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    QRCode.toDataURL(texto, { margin: 1, width: 600, errorCorrectionLevel: 'M' })
      .then((url) => vigente && setSrc(url))
      .catch(() => vigente && setSrc(null));
    return () => {
      vigente = false;
    };
  }, [texto]);
  return src ? <img src={src} alt={etiqueta} /> : <div style={{ aspectRatio: '1', width: '100%' }} aria-label={etiqueta} />;
}

export type PrefijoId = 'N' | 'R' | 'T' | 'D' | 'MC';

export function siguienteId(prefijo: PrefijoId, existentes: { id: string }[]): string {
  const maximo = existentes.reduce((max, { id }) => {
    const n = Number(id.slice(prefijo.length + 1));
    return id.startsWith(`${prefijo}-`) && Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `${prefijo}-${String(maximo + 1).padStart(2, '0')}`;
}

// crypto.getRandomValues funciona por http; crypto.randomUUID solo en contextos seguros.
export function idAzar(bytes = 16): string {
  const datos = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  let binario = '';
  for (const b of datos) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

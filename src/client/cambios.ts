// Un formulario guarda solo lo que la persona cambió respecto de lo que vio al abrirlo, y envía solo eso:
// si otra persona editó otro campo del mismo ítem mientras tanto, no se pisa (gana la última edición de cada campo).

export function aplicarCambio<T extends object, K extends keyof T>(cambios: Partial<T>, inicio: T, k: K, valor: T[K]): Partial<T> {
  const nuevo = { ...cambios, [k]: valor };
  if (valor === inicio[k]) delete nuevo[k];
  return nuevo;
}

// El borrador lleva una versión: los del formato anterior guardaban el formulario entero y no sirven como cambios.
const VERSION = 2;

export function guardarCambios<T extends object>(cambios: Partial<T>): string {
  return JSON.stringify({ v: VERSION, cambios });
}

export function leerCambios<T extends object>(texto: string): Partial<T> {
  try {
    const x: unknown = JSON.parse(texto);
    if (!x || typeof x !== 'object' || (x as { v?: unknown }).v !== VERSION) return {};
    const cambios = (x as { cambios?: unknown }).cambios;
    return cambios && typeof cambios === 'object' ? (cambios as Partial<T>) : {};
  } catch {
    return {};
  }
}

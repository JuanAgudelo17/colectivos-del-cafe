// Error con código HTTP y mensaje seguro para mostrar al usuario.
// `campos` (opcional) lleva errores por campo de formulario: { placa: 'mensaje' }.
export class ErrorHttp extends Error {
  constructor(status, mensaje, campos) {
    super(mensaje);
    this.status = status;
    this.campos = campos;
  }
}

export const noAutenticado = () => new ErrorHttp(401, 'Debes iniciar sesión');
export const prohibido = () => new ErrorHttp(403, 'No tienes permiso para esta acción');
export const noEncontrado = (que) => new ErrorHttp(404, `${que} no existe`);

// Traduce violaciones de restricciones de la BD (duplicados, referencias) a
// mensajes claros. Cada módulo declara las suyas en su index.js:
//   { nombre_restriccion: [status, campo, mensaje] }
export function traducirErrorBd(err, restricciones) {
  const regla = err?.constraint && restricciones[err.constraint];
  if (!regla) return null;
  const [status, campo, mensaje] = regla;
  return new ErrorHttp(status, mensaje, { [campo]: mensaje });
}

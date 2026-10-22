// Error con código HTTP y mensaje seguro para mostrar al usuario.
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export const noAutenticado = () => new ErrorHttp(401, 'Debes iniciar sesión');
export const prohibido = () => new ErrorHttp(403, 'No tienes permiso para esta acción');

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

// Violaciones de restricciones de la BD que el usuario puede provocar con datos
// válidos en forma (duplicados, referencias cruzadas), traducidas a mensajes claros.
const RESTRICCIONES = {
  empresa_nit_key: [409, 'nit', 'Ya existe una empresa con ese NIT'],
  buseta_placa_key: [409, 'placa', 'Ya existe una buseta con esa placa'],
  buseta_empresa_id_numero_interno_key: [409, 'numeroInterno', 'Ya existe una buseta con ese número interno en la empresa'],
  usuario_usuario_unico: [409, 'usuario', 'Ese nombre de usuario ya está en uso'],
  usuario_buseta_id_key: [409, 'busetaId', 'Esa buseta ya tiene otro conductor asignado'],
  usuario_buseta_id_empresa_id_fkey: [400, 'busetaId', 'La buseta no pertenece a la empresa del conductor'],
};

export function traducirErrorBd(err) {
  const regla = RESTRICCIONES[err.constraint];
  if (!regla) return null;
  const [status, campo, mensaje] = regla;
  return new ErrorHttp(status, mensaje, { [campo]: mensaje });
}

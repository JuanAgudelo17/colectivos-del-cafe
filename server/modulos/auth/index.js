// Módulo auth: login, logout, sesión actual, cambio de contraseña,
// recuperación (solicitudes al admin) y bloqueo por intentos fallidos.
import router from './rutas.js';

export { limpiarFallos } from './intentos.js';
export { asignarPasswordTemporal } from './repositorio.js';

export default {
  ruta: '/auth',
  router,
  restricciones: {},
};

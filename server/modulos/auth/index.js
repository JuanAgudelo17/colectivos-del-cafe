// Módulo auth: login, logout, sesión actual y bloqueo por intentos fallidos.
import router from './rutas.js';

export { limpiarFallos } from './intentos.js';

export default {
  ruta: '/auth',
  router,
  restricciones: {},
};

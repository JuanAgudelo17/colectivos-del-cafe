// Módulo conductores: cuentas de conductores, asignación de buseta y contraseñas.
import router from './rutas.js';

export { listarConductores } from './repositorio.js';

export default {
  ruta: '/conductores',
  router,
  restricciones: {
    usuario_usuario_unico: [409, 'usuario', 'Ese nombre de usuario ya está en uso'],
    usuario_buseta_id_key: [409, 'busetaId', 'Esa buseta ya tiene otro conductor asignado'],
  },
};

// Módulo dashboard: todo lo que muestra el panel general del admin en una sola
// petición. En Netlify cada petición simultánea despierta su propia instancia de
// la función (con arranque en frío y conexión nueva a la BD); una sola es más rápida.
import router from './rutas.js';

export default {
  ruta: '/dashboard',
  router,
  restricciones: {},
};

// Módulo busetas: flota, cupo/arriendo, foto y vencimiento de documentos
// (SOAT, tecnomecánica, tarjeta de operación, pólizas y extintor).
import router from './rutas.js';

export { listarBusetas, obtenerBuseta } from './repositorio.js';
export { redirigirAFoto } from './foto.js';

export default {
  ruta: '/busetas',
  router,
  restricciones: {
    buseta_placa_key: [409, 'placa', 'Ya existe una buseta con esa placa'],
    buseta_numero_interno_key: [409, 'numeroInterno', 'Ya existe una buseta con ese número interno'],
  },
};

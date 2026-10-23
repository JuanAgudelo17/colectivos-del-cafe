// Módulo producido: registro diario por buseta (admin), consulta del conductor,
// ajustes del mes (bono, préstamos), tarifas de rutas y el cálculo del resumen.
import router from './rutas.js';

export { calcularResumen } from './calculo.js';

export default {
  ruta: '/producido',
  router,
  restricciones: {},
};

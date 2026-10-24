import { PaginaMiColpass } from '../colpass/index.js';
import { PaginaMiProducido } from './PaginaMiProducido.jsx';

// Lo que otros módulos pueden usar de este (ver docs/MODULOS.md).
export { ResumenMiProducido } from './ResumenMiProducido.jsx';

export default {
  id: 'mi-producido',
  titulo: 'Mi producido',
  icono: 'dinero',
  ruta: 'mi-producido',
  Pagina: PaginaMiProducido,
  // Peajes Colpass: solo se llega desde la tarjeta de Mi producido (si la buseta lo tiene).
  subrutas: [{ ruta: 'peajes', Pagina: PaginaMiColpass }],
};

import { HojaDeVida } from './HojaDeVida.jsx';
import { PaginaBusetas } from './PaginaBusetas.jsx';

// Otros módulos (Mi buseta) muestran la foto con este componente.
export { FotoBuseta } from './FotoBuseta.jsx';

export default {
  id: 'busetas',
  titulo: 'Busetas',
  icono: 'buseta',
  ruta: 'busetas',
  Pagina: PaginaBusetas,
  subrutas: [{ ruta: ':id', Pagina: HojaDeVida }],
};

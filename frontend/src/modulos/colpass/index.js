import { PaginaColpass } from './PaginaColpass.jsx';

// Lo que otros módulos pueden usar de este (ver docs/MODULOS.md): la vista del
// conductor vive como subpágina de "Mi producido".
export { AvisoColpass, PaginaMiColpass } from './PaginaMiColpass.jsx';

export default { id: 'colpass', titulo: 'Colpass', icono: 'peaje', ruta: 'colpass', Pagina: PaginaColpass };

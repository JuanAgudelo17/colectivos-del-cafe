import { PaginaFacturas } from './PaginaFacturas.jsx';

// La misma página para los dos roles: el admin ve las de toda la flota y el
// conductor las de su buseta ("Mis facturas").
export default { id: 'facturas', titulo: 'Facturas', icono: 'factura', ruta: 'facturas', Pagina: PaginaFacturas };

export const misFacturas = { id: 'mis-facturas', titulo: 'Mis facturas', icono: 'factura', ruta: 'facturas', Pagina: PaginaFacturas };

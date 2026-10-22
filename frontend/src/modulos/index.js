// Registro de módulos del frontend. Cada módulo vive en su carpeta y exporta
// en su index.js: { id, titulo, icono, ruta, Pagina }.
// Para agregar uno: crea la carpeta, su index.js y súmalo a la lista de su rol.
// Los que todavía no existen se listan con `fase` y salen deshabilitados en el menú.
import busetas from './busetas/index.js';
import conductores from './conductores/index.js';
import dashboard from './dashboard/index.js';
import miBuseta from './mi-buseta/index.js';

export const modulosAdmin = [
  dashboard,
  busetas,
  conductores,
  { id: 'producido', titulo: 'Producido', icono: '💵', fase: 2 },
  { id: 'facturas', titulo: 'Facturas', icono: '🧾', fase: 2 },
  { id: 'cierre', titulo: 'Cierre mensual', icono: '📊', fase: 3 },
];

export const modulosConductor = [
  miBuseta,
  { id: 'mi-producido', titulo: 'Mi producido', icono: '💵', fase: 2 },
  { id: 'mis-facturas', titulo: 'Mis facturas', icono: '🧾', fase: 2 },
];

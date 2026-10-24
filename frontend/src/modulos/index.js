// Registro de módulos del frontend. Cada módulo vive en su carpeta y exporta
// en su index.js: { id, titulo, icono, ruta, Pagina, subrutas? }.
// `subrutas: [{ ruta: ':id', Pagina }]` agrega páginas internas (ej. /admin/busetas/3).
// Para agregar uno: crea la carpeta, su index.js y súmalo al grupo del menú de su rol.
// Los que todavía no existen se listan con `fase` y salen deshabilitados en el menú.
import busetas from './busetas/index.js';
import conductores from './conductores/index.js';
import dashboard from './dashboard/index.js';
import miBuseta from './mi-buseta/index.js';
import miProducido from './mi-producido/index.js';
import producido from './producido/index.js';
import ranking from './ranking/index.js';
import rentabilidad from './rentabilidad/index.js';

// Menú lateral de cada rol, agrupado por secciones.
export const menuAdmin = [
  { grupo: 'General', modulos: [dashboard] },
  { grupo: 'Contabilidad', modulos: [producido, rentabilidad, ranking] },
  { grupo: 'Flota', modulos: [busetas, conductores] },
  {
    grupo: 'Próximamente',
    modulos: [
      { id: 'facturas', titulo: 'Facturas', icono: 'factura', fase: 2 },
      { id: 'cierre', titulo: 'Cierre mensual', icono: 'cierre', fase: 3 },
    ],
  },
];

export const menuConductor = [
  { grupo: 'Mi trabajo', modulos: [miBuseta, miProducido, ranking] },
  {
    grupo: 'Próximamente',
    modulos: [
      { id: 'mis-facturas', titulo: 'Mis facturas', icono: 'factura', fase: 2 },
    ],
  },
];

// Lista plana de cada rol (para armar las rutas).
export const modulosAdmin = menuAdmin.flatMap((g) => g.modulos);
export const modulosConductor = menuConductor.flatMap((g) => g.modulos);

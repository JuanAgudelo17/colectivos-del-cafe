// Registro de módulos del backend. Para agregar uno nuevo:
//   1. Crea server/modulos/<nombre>/ con rutas.js e index.js (ver busetas/ como ejemplo).
//   2. Agrégalo a esta lista.
// Cada módulo queda montado en /api<ruta>.
import auth from './auth/index.js';
import busetas from './busetas/index.js';
import conductores from './conductores/index.js';
import miBuseta from './mi-buseta/index.js';
import salud from './salud/index.js';

export const modulos = [salud, auth, busetas, conductores, miBuseta];

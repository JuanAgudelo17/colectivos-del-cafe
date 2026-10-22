import pg from 'pg';
import { OPCIONES_SSL, urlBaseDatos } from './conexion.js';
import { PARSERS } from './tipos.js';

for (const [oid, parser] of Object.entries(PARSERS)) {
  pg.types.setTypeParser(Number(oid), parser);
}

// Pool para la función de Netlify. Cada instancia atiende una petición a la vez,
// así que bastan pocas conexiones; el pooler de Supabase hace el resto.
export function crearPool() {
  return new pg.Pool({
    connectionString: urlBaseDatos(),
    ssl: OPCIONES_SSL,
    max: 2,
    idleTimeoutMillis: 10_000,
  });
}

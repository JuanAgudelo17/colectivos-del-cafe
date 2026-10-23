// Crea en Supabase Storage los buckets privados que usa la app (si no existen).
// Se corre una vez por proyecto de Supabase, igual que las migraciones.
// Uso: npm run crear-buckets
import { cargarEnv } from '../compartido/bd/conexion.js';
import { BUCKETS, crearAlmacenSupabase } from '../compartido/almacen.js';
import { LIMITE_IMAGEN, TIPOS_IMAGEN } from '../compartido/http/imagenes.js';

cargarEnv();
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: clave } = process.env;

if (!url || !clave) {
  console.error('✘ Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env (ver .env.example).');
  process.exit(1);
}

const almacen = crearAlmacenSupabase({ url, clave });

try {
  for (const bucket of BUCKETS) {
    const creado = await almacen.crearBucket(bucket, {
      tiposPermitidos: Object.keys(TIPOS_IMAGEN),
      limiteBytes: LIMITE_IMAGEN,
    });
    console.log(creado ? `✔ Bucket privado "${bucket}" creado` : `• El bucket "${bucket}" ya existía`);
  }
} catch (err) {
  console.error(`✘ ${err.message}`);
  process.exitCode = 1;
}

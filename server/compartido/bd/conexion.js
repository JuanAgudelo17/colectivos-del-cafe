import pg from 'pg';

// Carga .env de la raíz del repo si existe (en Netlify las variables vienen del panel).
export function cargarEnv() {
  try {
    process.loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export function urlBaseDatos() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Falta DATABASE_URL. Cópiala de Supabase al archivo .env (ver .env.example).');
  }
  return url;
}

// Supabase exige SSL. Su certificado lo firma una CA propia de Supabase,
// por eso no se valida contra las CA públicas.
export const OPCIONES_SSL = { rejectUnauthorized: false };

// Ejecuta un script de consola con un cliente conectado y muestra los errores
// como un mensaje corto en vez de un stack trace.
export async function conCliente(fn) {
  cargarEnv();
  let db;
  try {
    db = await conectarCliente();
    await fn(db);
  } catch (err) {
    console.error(`✘ ${err.message}`);
    process.exitCode = 1;
  } finally {
    await db?.cerrar();
  }
}

// Cliente suelto para scripts de consola (migrar, crear-admin).
export async function conectarCliente() {
  const cliente = new pg.Client({ connectionString: urlBaseDatos(), ssl: OPCIONES_SSL });
  await cliente.connect();
  return {
    exec: (sql) => cliente.query(sql),
    query: (sql, params) => cliente.query(sql, params),
    cerrar: () => cliente.end(),
  };
}

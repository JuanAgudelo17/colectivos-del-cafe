import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIRECTORIO_MIGRACIONES = fileURLToPath(new URL('../../../db/migrations/', import.meta.url));

// Archivos tipo 001_nombre.sql, en orden.
export async function listarMigraciones(dir = DIRECTORIO_MIGRACIONES) {
  const archivos = await readdir(dir);
  return archivos.filter((a) => /^\d{3}_.+\.sql$/.test(a)).sort();
}

// Aplica las migraciones pendientes, cada una en su propia transacción.
// `db` expone exec(sql) para SQL de varias sentencias y query(sql, params).
// Devuelve los nombres de las migraciones aplicadas en esta corrida.
export async function aplicarMigraciones(db, dir = DIRECTORIO_MIGRACIONES) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migraciones (
      nombre      TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE schema_migraciones ENABLE ROW LEVEL SECURITY;
  `);

  const { rows } = await db.query('SELECT nombre FROM schema_migraciones');
  const yaAplicadas = new Set(rows.map((r) => r.nombre));
  const aplicadas = [];

  for (const nombre of await listarMigraciones(dir)) {
    if (yaAplicadas.has(nombre)) continue;

    const sql = await readFile(join(dir, nombre), 'utf8');
    await db.exec('BEGIN');
    try {
      await db.exec(sql);
      await db.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [nombre]);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      err.message = `Migración ${nombre} falló: ${err.message}`;
      throw err;
    }
    aplicadas.push(nombre);
  }

  return aplicadas;
}

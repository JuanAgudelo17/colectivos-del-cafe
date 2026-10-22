// Aplica en la base de datos las migraciones de db/migrations que falten.
// Uso: npm run migrar
import { conCliente } from '../db/conexion.js';
import { aplicarMigraciones, listarMigraciones } from '../db/migraciones.js';

await conCliente(async (db) => {
  const total = (await listarMigraciones()).length;
  const aplicadas = await aplicarMigraciones(db);

  if (aplicadas.length === 0) {
    console.log(`La base de datos ya está al día (${total} migraciones).`);
    return;
  }
  for (const nombre of aplicadas) console.log(`✔ ${nombre}`);
  console.log(`Listo: ${aplicadas.length} migración(es) aplicada(s).`);
});

import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { aplicarMigraciones } from '../db/migraciones.js';
import { PARSERS } from '../db/tipos.js';

process.env.JWT_SECRET ??= 'secreto-de-pruebas-con-mas-de-32-caracteres';

// Base de datos en memoria con todas las migraciones aplicadas.
export async function crearBdPrueba() {
  const db = new PGlite({ parsers: PARSERS });
  await aplicarMigraciones(db);
  return db;
}

// Costo bajo de bcrypt para que las pruebas sean rápidas.
export const hashPrueba = (password) => bcrypt.hash(password, 4);

export async function iniciarServidor(app) {
  const servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  return {
    base: `http://localhost:${servidor.address().port}`,
    cerrar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

// Extrae "nombre=valor" del Set-Cookie para reenviarlo en la siguiente petición.
export function cookieDe(res, nombre = 'sesion') {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`));
  return cookie?.split(';')[0] ?? null;
}

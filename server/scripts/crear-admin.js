// Crea un usuario administrador global con una contraseña aleatoria que se
// muestra una sola vez. Así ninguna contraseña queda escrita en git ni en el
// historial de la terminal.
// Uso: npm run crear-admin -- --usuario juan --nombre "Juan Agudelo"
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { conCliente } from '../db/conexion.js';

const { values } = parseArgs({
  options: {
    usuario: { type: 'string' },
    nombre: { type: 'string' },
  },
});

if (!values.usuario || !values.nombre) {
  console.error('Uso: npm run crear-admin -- --usuario <usuario> --nombre "<Nombre completo>"');
  process.exit(1);
}

await conCliente(async (db) => {
  const password = randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.query(
      `INSERT INTO usuario (usuario, nombre, password_hash, rol)
       VALUES ($1, $2, $3, 'admin')`,
      [values.usuario.trim(), values.nombre.trim(), passwordHash],
    );
  } catch (err) {
    if (err.code === '23505') err.message = `El usuario "${values.usuario}" ya existe.`;
    throw err;
  }

  console.log(`✔ Admin "${values.usuario}" creado.`);
  console.log(`  Contraseña: ${password}`);
  console.log('  Guárdala en tu gestor de contraseñas; no se vuelve a mostrar.');
});

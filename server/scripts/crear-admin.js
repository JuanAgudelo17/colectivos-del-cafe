// Crea un usuario administrador con una contraseña aleatoria que se
// muestra una sola vez. Así ninguna contraseña queda escrita en git ni en el
// historial de la terminal.
// Uso: npm run crear-admin -- --usuario juan --nombre "Juan Agudelo"
import { parseArgs } from 'node:util';
import { conCliente } from '../compartido/bd/conexion.js';
import { generarPassword, hashPassword } from '../compartido/seguridad/passwords.js';

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
  // El admin lo ve todo: contraseña más larga que la de los conductores.
  const password = generarPassword(16);
  const passwordHash = await hashPassword(password);

  try {
    // Sin vencimiento, pero al entrar debe crear su propia contraseña.
    await db.query(
      `INSERT INTO usuario (usuario, nombre, password_hash, rol, debe_cambiar_password)
       VALUES ($1, $2, $3, 'admin', TRUE)`,
      [values.usuario.trim(), values.nombre.trim(), passwordHash],
    );
  } catch (err) {
    if (err.code === '23505') err.message = `El usuario "${values.usuario}" ya existe.`;
    throw err;
  }

  console.log(`✔ Admin "${values.usuario}" creado.`);
  console.log(`  Contraseña inicial: ${password}`);
  console.log('  Úsala para entrar: el sistema te pedirá crear tu propia contraseña.');
});

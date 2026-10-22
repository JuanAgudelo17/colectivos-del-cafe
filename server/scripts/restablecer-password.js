// Da una contraseña temporal a cualquier usuario (útil si el admin olvida la suya).
// Se muestra una sola vez; al entrar con ella el usuario debe crear la propia.
// Uso: npm run restablecer-password -- --usuario juan
import { parseArgs } from 'node:util';
import { conCliente } from '../compartido/bd/conexion.js';
import { generarPassword, hashPassword, HORAS_PASSWORD_TEMPORAL } from '../compartido/seguridad/passwords.js';
import { asignarPasswordTemporal, limpiarFallos } from '../modulos/auth/index.js';

const { values } = parseArgs({ options: { usuario: { type: 'string' } } });

if (!values.usuario) {
  console.error('Uso: npm run restablecer-password -- --usuario <usuario>');
  process.exit(1);
}

await conCliente(async (db) => {
  const { rows } = await db.query('SELECT id, usuario FROM usuario WHERE lower(usuario) = lower($1)', [
    values.usuario.trim(),
  ]);
  if (!rows[0]) throw new Error(`El usuario "${values.usuario}" no existe.`);

  const password = generarPassword(12);
  await asignarPasswordTemporal(db, rows[0].id, await hashPassword(password));
  await limpiarFallos(db, rows[0].usuario);

  console.log(`✔ Contraseña temporal para "${rows[0].usuario}": ${password}`);
  console.log(`  Vence en ${HORAS_PASSWORD_TEMPORAL} horas. Al entrar deberá crear su propia contraseña.`);
});

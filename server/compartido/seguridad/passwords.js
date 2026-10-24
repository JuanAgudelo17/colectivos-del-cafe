import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Sin caracteres que se confunden al dictar o leer en el celular (l/1, o/0, i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
// 10 = mínimo recomendado por OWASP. En Netlify (bcryptjs, sin código nativo) cada
// comparación con 12 tardaba ~0,6-0,9 s; con 10, ~4 veces menos.
const COSTO_BCRYPT = 10;

// Hash fijo (de una cadena aleatoria descartada, con el mismo costo) para comparar
// cuando el usuario no existe: la respuesta tarda lo mismo y no revela qué usuarios
// existen. Va quemado para no gastar un hash en cada arranque de la función.
export const HASH_RELLENO = '$2b$10$mku6PFcmmTbxi1I8EVLsp.qGSk5rj1qjFATG9T1GbkYyfMGBScohy';

// Una contraseña generada por el sistema solo sirve para entrar y crear la propia.
export const HORAS_PASSWORD_TEMPORAL = 48;

export function generarPassword(largo = 10) {
  let password = '';
  for (let i = 0; i < largo; i++) password += ALFABETO[randomInt(ALFABETO.length)];
  return password;
}

export const hashPassword = (password) => bcrypt.hash(password, COSTO_BCRYPT);

// Hashes hechos con un costo mayor al actual (los de 12 de antes): se rehacen al
// entrar, cuando se tiene la contraseña, para que el próximo login sea rápido.
export const necesitaRehash = (hash) => bcrypt.getRounds(hash) > COSTO_BCRYPT;

// Reglas para la contraseña que elige el usuario. bcrypt solo usa los primeros 72 bytes.
export const passwordNueva = z
  .string({ message: 'Escribe la contraseña nueva' })
  .min(8, 'Debe tener al menos 8 caracteres')
  .refine((v) => Buffer.byteLength(v) <= 72, 'Es demasiado larga')
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), 'Debe tener al menos una letra y un número');

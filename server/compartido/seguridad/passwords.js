import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Sin caracteres que se confunden al dictar o leer en el celular (l/1, o/0, i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const COSTO_BCRYPT = 12;

// Una contraseña generada por el sistema solo sirve para entrar y crear la propia.
export const HORAS_PASSWORD_TEMPORAL = 48;

export function generarPassword(largo = 10) {
  let password = '';
  for (let i = 0; i < largo; i++) password += ALFABETO[randomInt(ALFABETO.length)];
  return password;
}

export const hashPassword = (password) => bcrypt.hash(password, COSTO_BCRYPT);

// Reglas para la contraseña que elige el usuario. bcrypt solo usa los primeros 72 bytes.
export const passwordNueva = z
  .string({ message: 'Escribe la contraseña nueva' })
  .min(8, 'Debe tener al menos 8 caracteres')
  .refine((v) => Buffer.byteLength(v) <= 72, 'Es demasiado larga')
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), 'Debe tener al menos una letra y un número');

import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

// Sin caracteres que se confunden al dictar o leer en el celular (l/1, o/0, i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const COSTO_BCRYPT = 12;

export function generarPassword(largo = 10) {
  let password = '';
  for (let i = 0; i < largo; i++) password += ALFABETO[randomInt(ALFABETO.length)];
  return password;
}

export const hashPassword = (password) => bcrypt.hash(password, COSTO_BCRYPT);

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { buscarParaLogin } from '../db/usuarios.js';
import { ErrorHttp } from '../lib/errores.js';
import { borrarCookieSesion, ponerCookieSesion } from '../lib/sesion.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

// Hash de relleno para comparar cuando el usuario no existe, de modo que la
// respuesta tarde lo mismo y no revele qué usuarios existen.
let hashRelleno;

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};
  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario.trim() || !password) {
    throw new ErrorHttp(400, 'Escribe tu usuario y contraseña');
  }

  const encontrado = await buscarParaLogin(req.app.locals.db, usuario.trim());
  hashRelleno ??= await bcrypt.hash('relleno', 12);
  const valida = await bcrypt.compare(password, encontrado?.passwordHash ?? hashRelleno);

  if (!encontrado || !valida) {
    throw new ErrorHttp(401, 'Usuario o contraseña incorrectos');
  }

  const { passwordHash: _, ...sesion } = encontrado;
  await ponerCookieSesion(res, sesion.id);
  res.json({ usuario: sesion });
});

router.post('/logout', (req, res) => {
  borrarCookieSesion(res);
  res.status(204).end();
});

router.get('/yo', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

export default router;

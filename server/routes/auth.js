import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { estaBloqueado, limpiarFallos, registrarFallo, VENTANA_MIN } from '../db/intentosLogin.js';
import { buscarParaLogin } from '../db/usuarios.js';
import { ErrorHttp } from '../lib/errores.js';
import { borrarCookieSesion, ponerCookieSesion } from '../lib/sesion.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

// Hash de relleno para comparar cuando el usuario no existe, de modo que la
// respuesta tarde lo mismo y no revele qué usuarios existen.
let hashRelleno;

// Netlify pone la IP real del cliente en este encabezado (no se puede falsificar).
const ipCliente = (req) => req.headers['x-nf-client-connection-ip'] ?? req.ip ?? null;

router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  const { usuario: usuarioCrudo, password } = req.body ?? {};
  const usuario = typeof usuarioCrudo === 'string' ? usuarioCrudo.trim() : '';
  if (!usuario || typeof password !== 'string' || !password) {
    throw new ErrorHttp(400, 'Escribe tu usuario y contraseña');
  }

  const ip = ipCliente(req);
  if (await estaBloqueado(db, usuario, ip)) {
    throw new ErrorHttp(429, `Demasiados intentos fallidos. Espera ${VENTANA_MIN} minutos e intenta de nuevo.`);
  }

  const encontrado = await buscarParaLogin(db, usuario);
  hashRelleno ??= await bcrypt.hash('relleno', 12);
  const valida = await bcrypt.compare(password, encontrado?.passwordHash ?? hashRelleno);

  if (!encontrado || !valida) {
    await registrarFallo(db, usuario, ip);
    throw new ErrorHttp(401, 'Usuario o contraseña incorrectos');
  }

  await limpiarFallos(db, usuario);
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

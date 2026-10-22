import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ErrorHttp } from '../../compartido/http/errores.js';
import { validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { hashPassword, passwordNueva } from '../../compartido/seguridad/passwords.js';
import { borrarCookieSesion, ponerCookieSesion } from '../../compartido/seguridad/sesion.js';
import { estaBloqueado, limpiarFallos, registrarFallo, VENTANA_MIN } from './intentos.js';
import { crearSolicitud, listarPendientes } from './recuperacion.js';
import { buscarParaLogin, guardarPasswordPropia, obtenerHash } from './repositorio.js';

const router = Router();

// Hash de relleno para comparar cuando el usuario no existe, de modo que la
// respuesta tarde lo mismo y no revele qué usuarios existen.
let hashRelleno;

// Netlify pone la IP real del cliente en este encabezado (no se puede falsificar).
const ipCliente = (req) => req.headers['x-nf-client-connection-ip'] ?? req.ip ?? null;

const bloqueado = () =>
  new ErrorHttp(429, `Demasiados intentos fallidos. Espera ${VENTANA_MIN} minutos e intenta de nuevo.`);

router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  const { usuario: usuarioCrudo, password } = req.body ?? {};
  const usuario = typeof usuarioCrudo === 'string' ? usuarioCrudo.trim() : '';
  if (!usuario || typeof password !== 'string' || !password) {
    throw new ErrorHttp(400, 'Escribe tu usuario y contraseña');
  }

  const ip = ipCliente(req);
  if (await estaBloqueado(db, usuario, ip)) throw bloqueado();

  const encontrado = await buscarParaLogin(db, usuario);
  hashRelleno ??= await bcrypt.hash('relleno', 12);
  const valida = await bcrypt.compare(password, encontrado?.passwordHash ?? hashRelleno);

  if (!encontrado || !valida) {
    await registrarFallo(db, usuario, ip);
    throw new ErrorHttp(401, 'Usuario o contraseña incorrectos');
  }
  if (encontrado.debeCambiarPassword && encontrado.temporalVencida) {
    throw new ErrorHttp(401, 'Tu contraseña temporal venció. Pide una nueva al administrador.');
  }

  await limpiarFallos(db, usuario);
  const { passwordHash: _, temporalVencida: __, sesionVersion, ...sesion } = encontrado;
  await ponerCookieSesion(res, sesion.id, sesionVersion);
  res.json({ usuario: sesion });
});

router.post('/logout', (req, res) => {
  borrarCookieSesion(res);
  res.status(204).end();
});

router.get('/yo', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

// Cambiar la contraseña (voluntario, o obligatorio tras una temporal).
const esquemaCambio = z.object({
  actual: z.string({ message: 'Escribe tu contraseña actual' }).min(1, 'Escribe tu contraseña actual'),
  nueva: passwordNueva,
});

router.post('/cambiar-password', autenticar, async (req, res) => {
  const db = req.app.locals.db;
  const { actual, nueva } = validar(esquemaCambio, req.body);
  const { id, usuario } = req.usuario;

  const ip = ipCliente(req);
  if (await estaBloqueado(db, usuario, ip)) throw bloqueado();

  if (!(await bcrypt.compare(actual, await obtenerHash(db, id)))) {
    await registrarFallo(db, usuario, ip);
    const mensaje = 'La contraseña actual no es correcta';
    throw new ErrorHttp(400, mensaje, { actual: mensaje });
  }
  if (nueva === actual) {
    const mensaje = 'La nueva debe ser distinta a la actual';
    throw new ErrorHttp(400, mensaje, { nueva: mensaje });
  }
  if (nueva.toLowerCase().includes(usuario.toLowerCase())) {
    const mensaje = 'No uses tu nombre de usuario dentro de la contraseña';
    throw new ErrorHttp(400, mensaje, { nueva: mensaje });
  }

  const version = await guardarPasswordPropia(db, id, await hashPassword(nueva));
  await limpiarFallos(db, usuario);
  // Esta sesión sigue abierta con la versión nueva; las demás quedan cerradas.
  await ponerCookieSesion(res, id, version);
  res.json({ usuario: { ...req.usuario, debeCambiarPassword: false } });
});

// "Olvidé mi contraseña": deja una solicitud para el admin. Siempre responde
// lo mismo para no revelar qué usuarios existen.
router.post('/recuperar', async (req, res) => {
  const db = req.app.locals.db;
  const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
  if (!usuario) throw new ErrorHttp(400, 'Escribe tu usuario', { usuario: 'Escribe tu usuario' });

  await crearSolicitud(db, usuario, ipCliente(req));
  res.status(202).json({
    mensaje:
      'Listo. Si el usuario existe, el administrador verá tu solicitud y te enviará una contraseña temporal.',
  });
});

router.get('/solicitudes', autenticar, requiereRol('admin'), async (req, res) => {
  res.json({ solicitudes: await listarPendientes(req.app.locals.db) });
});

export default router;

import { buscarSesion } from '../db/usuarios.js';
import { noAutenticado, prohibido } from '../lib/errores.js';
import {
  COOKIE_SESION,
  borrarCookieSesion,
  leerCookie,
  ponerCookieSesion,
  verificarToken,
} from '../lib/sesion.js';

// Exige una sesión válida y deja el usuario en req.usuario.
// Renueva la cookie en cada petición (expiración por inactividad).
export async function autenticar(req, res, next) {
  const token = leerCookie(req, COOKIE_SESION);
  const id = token && (await verificarToken(token));
  const usuario = id && (await buscarSesion(req.app.locals.db, id));

  if (!usuario) {
    if (token) borrarCookieSesion(res);
    throw noAutenticado();
  }

  req.usuario = usuario;
  await ponerCookieSesion(res, usuario.id);
  next();
}

// Uso: router.get('/x', autenticar, requiereRol('admin'), handler)
export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) throw noAutenticado();
    if (!roles.includes(req.usuario.rol)) throw prohibido();
    next();
  };
}

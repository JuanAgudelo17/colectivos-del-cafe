import { noAutenticado, prohibido } from '../http/errores.js';
import { COOKIE_SESION, borrarCookieSesion, leerCookie, ponerCookieSesion, verificarToken } from './sesion.js';

// Usuario activo de una sesión. Se consulta en cada petición para que
// desactivar a alguien le corte el acceso de inmediato.
async function buscarUsuarioSesion(db, id) {
  const { rows } = await db.query(
    `SELECT id, usuario, nombre, rol, buseta_id AS "busetaId"
       FROM usuario
      WHERE id = $1 AND activo`,
    [id],
  );
  return rows[0] ?? null;
}

// Exige una sesión válida y deja el usuario en req.usuario.
// Renueva la cookie en cada petición (expiración por inactividad).
export async function autenticar(req, res, next) {
  const token = leerCookie(req, COOKIE_SESION);
  const id = token && (await verificarToken(token));
  const usuario = id && (await buscarUsuarioSesion(req.app.locals.db, id));

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

// Filtros que toda consulta de producido/facturas debe aplicar según quién pregunta.
// Admin: sin restricción (null). Conductor: solo su buseta y sus registros.
export function alcance(usuario) {
  if (usuario.rol === 'admin') return { busetaId: null, conductorId: null };
  return { busetaId: usuario.busetaId, conductorId: usuario.id };
}

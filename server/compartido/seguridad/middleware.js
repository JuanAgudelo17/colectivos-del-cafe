import { ErrorHttp, noAutenticado, prohibido } from '../http/errores.js';
import { COOKIE_SESION, borrarCookieSesion, leerCookie, ponerCookieSesion, verificarToken } from './sesion.js';

// Usuario activo de una sesión. Se consulta en cada petición para que
// desactivar a alguien o cambiar su contraseña le corte el acceso de inmediato.
async function buscarUsuarioSesion(db, id) {
  const { rows } = await db.query(
    `SELECT id, usuario, nombre, rol,
            buseta_id             AS "busetaId",
            debe_cambiar_password AS "debeCambiarPassword",
            sesion_version        AS "sesionVersion"
       FROM usuario
      WHERE id = $1 AND activo`,
    [id],
  );
  return rows[0] ?? null;
}

// Exige una sesión válida y deja el usuario en req.usuario.
// Renueva la cookie en cada petición (expiración por inactividad), salvo las que
// el navegador hace solo en segundo plano (encabezado X-Segundo-Plano: 1, ej. la
// campanita cada 5 min): si no, con la app abierta la sesión nunca vencería.
export async function autenticar(req, res, next) {
  const token = leerCookie(req, COOKIE_SESION);
  const sesion = token && (await verificarToken(token));
  const encontrado = sesion && (await buscarUsuarioSesion(req.app.locals.db, sesion.id));

  // Token de antes del último cambio de contraseña → ya no sirve.
  if (!encontrado || encontrado.sesionVersion !== sesion.version) {
    if (token) borrarCookieSesion(res);
    throw noAutenticado();
  }

  const { sesionVersion, ...usuario } = encontrado;
  req.usuario = usuario;
  if (req.get('x-segundo-plano') !== '1') await ponerCookieSesion(res, usuario.id, sesionVersion);
  next();
}

// Uso: router.get('/x', autenticar, requiereRol('admin'), handler)
// Mientras el usuario tenga una contraseña temporal solo puede cambiarla.
export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) throw noAutenticado();
    if (req.usuario.debeCambiarPassword) {
      throw new ErrorHttp(403, 'Primero debes crear tu propia contraseña');
    }
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

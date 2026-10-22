import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_SESION = 'sesion';
// Inactividad máxima: cada petición autenticada renueva el token por otros 30 min.
export const DURACION_SESION_SEG = 30 * 60;

function llaveSecreta() {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('JWT_SECRET falta o es muy corto (mínimo 32 caracteres)');
  }
  return new TextEncoder().encode(secreto);
}

// `version` = usuario.sesion_version: al cambiar la contraseña sube y los
// tokens anteriores dejan de servir.
export async function firmarToken(usuarioId, version = 0, ahora = Math.floor(Date.now() / 1000)) {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuarioId))
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + DURACION_SESION_SEG)
    .sign(llaveSecreta());
}

// Devuelve { id, version }, o null si el token es inválido o expiró.
export async function verificarToken(token) {
  try {
    const { payload } = await jwtVerify(token, llaveSecreta(), { algorithms: ['HS256'] });
    const id = Number(payload.sub);
    const version = Number(payload.v ?? 0);
    return Number.isSafeInteger(id) && Number.isSafeInteger(version) ? { id, version } : null;
  } catch (err) {
    if (err.code?.startsWith('ERR_JW')) return null;
    throw err;
  }
}

export function opcionesCookie() {
  return {
    httpOnly: true,
    // En `netlify dev` se sirve por http://localhost; en Netlify siempre es HTTPS.
    secure: process.env.NETLIFY_DEV !== 'true',
    sameSite: 'strict',
    path: '/',
  };
}

// Reemplaza cualquier cookie de sesión puesta antes en la misma respuesta
// (ej. la que renovó `autenticar` antes de un cambio de contraseña).
export async function ponerCookieSesion(res, usuarioId, version) {
  const otras = [res.get('Set-Cookie') ?? []].flat().filter((c) => !c.startsWith(`${COOKIE_SESION}=`));
  if (otras.length) res.set('Set-Cookie', otras);
  else res.removeHeader('Set-Cookie');

  res.cookie(COOKIE_SESION, await firmarToken(usuarioId, version), {
    ...opcionesCookie(),
    maxAge: DURACION_SESION_SEG * 1000,
  });
}

export function borrarCookieSesion(res) {
  res.clearCookie(COOKIE_SESION, opcionesCookie());
}

export function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return null;
}

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

export async function firmarToken(usuarioId, ahora = Math.floor(Date.now() / 1000)) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuarioId))
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + DURACION_SESION_SEG)
    .sign(llaveSecreta());
}

// Devuelve el id del usuario, o null si el token es inválido o expiró.
export async function verificarToken(token) {
  try {
    const { payload } = await jwtVerify(token, llaveSecreta(), { algorithms: ['HS256'] });
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) ? id : null;
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

export async function ponerCookieSesion(res, usuarioId) {
  res.cookie(COOKIE_SESION, await firmarToken(usuarioId), {
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

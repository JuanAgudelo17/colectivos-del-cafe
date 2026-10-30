// Evento que se emite cuando el backend responde 401 (sesión vencida o inválida).
export const EVENTO_SESION_EXPIRADA = 'sesion-expirada';

// Sin señal (conductor): el service worker (public/sw.js) guarda las consultas
// marcadas con X-Sin-Conexion y, sin red, devuelve lo guardado con el encabezado
// X-Guardado-En. Cada respuesta emite este evento con esa fecha (o null si es fresca).
export const EVENTO_CONEXION = 'datos-sin-conexion';
const CACHE_DATOS = 'el-producido-datos-v1'; // el mismo nombre que en sw.js
let guardarSinConexion = false;

// Solo para conductores: lo suyo queda guardado en el celular para verlo sin señal.
export function configurarSinConexion(activo) {
  guardarSinConexion = activo;
}

// Al salir o cuando vence la sesión: que no quede nada guardado en el celular.
export function borrarDatosSinConexion() {
  return globalThis.caches?.delete(CACHE_DATOS).catch(() => {});
}

// Cliente HTTP único para hablar con el backend. Envía la cookie de sesión
// y convierte errores de red o HTTP en mensajes claros en español.
// `cuerpo` puede ser un objeto (va como JSON) o un archivo/Blob (va tal cual, con su tipo).
// `segundoPlano`: consulta automática que no cuenta como actividad (no renueva la sesión).
export async function api(ruta, { cuerpo, headers, segundoPlano = false, ...opciones } = {}) {
  const esArchivo = cuerpo instanceof Blob;
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: {
        'Content-Type': esArchivo ? cuerpo.type : 'application/json',
        ...(segundoPlano && { 'X-Segundo-Plano': '1' }),
        ...(guardarSinConexion && !opciones.method && { 'X-Sin-Conexion': '1' }),
        ...headers,
      },
      body: cuerpo === undefined || esArchivo ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet.');
  }

  if (res.ok) {
    window.dispatchEvent(new CustomEvent(EVENTO_CONEXION, { detail: res.headers.get('X-Guardado-En') }));
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !ruta.startsWith('/auth/')) {
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    const error = new Error(datos?.error ?? `Error ${res.status}`);
    error.status = res.status;
    error.campos = datos?.campos ?? {};
    throw error;
  }
  return datos;
}

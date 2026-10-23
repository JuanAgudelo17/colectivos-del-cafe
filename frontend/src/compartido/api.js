// Evento que se emite cuando el backend responde 401 (sesión vencida o inválida).
export const EVENTO_SESION_EXPIRADA = 'sesion-expirada';

// Cliente HTTP único para hablar con el backend. Envía la cookie de sesión
// y convierte errores de red o HTTP en mensajes claros en español.
// `cuerpo` puede ser un objeto (va como JSON) o un archivo/Blob (va tal cual, con su tipo).
export async function api(ruta, { cuerpo, headers, ...opciones } = {}) {
  const esArchivo = cuerpo instanceof Blob;
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: { 'Content-Type': esArchivo ? cuerpo.type : 'application/json', ...headers },
      body: cuerpo === undefined || esArchivo ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet.');
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

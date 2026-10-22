// Cliente HTTP único para hablar con el backend. Envía la cookie de sesión
// y convierte errores de red o HTTP en mensajes claros en español.
export async function api(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
      ...opciones,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet.');
  }

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(cuerpo?.error ?? `Error ${res.status}`);
  }
  return cuerpo;
}

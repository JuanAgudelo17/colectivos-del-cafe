import { api } from '../../compartido/api.js';

// Notificaciones push en este navegador: activar, desactivar y saber si están activas.

export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// En iPhone las notificaciones solo funcionan con la app agregada a la pantalla de inicio.
export const esIphoneSinInstalar = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches &&
  !navigator.standalone;

export const permisoDenegado = () => pushSoportado() && Notification.permission === 'denied';

export async function suscripcionActual() {
  if (!pushSoportado()) return null;
  const registro = await navigator.serviceWorker.getRegistration('/');
  return registro ? registro.pushManager.getSubscription() : null;
}

// La clave pública VAPID viene en base64url; el navegador la pide en bytes.
function aBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const binario = atob((base64url + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export async function activarPush(clavePublica) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('No se dio permiso. Puedes activarlo en los ajustes del navegador para este sitio.');
  }
  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let suscripcion;
  try {
    suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) }));
  } catch {
    throw new Error('Este navegador no pudo activar las notificaciones. Prueba con Chrome en Android o con la app instalada en el iPhone.');
  }
  await api('/notificaciones/suscripcion', { method: 'POST', cuerpo: suscripcion.toJSON() });
}

export async function desactivarPush() {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  await api('/notificaciones/suscripcion', { method: 'DELETE', cuerpo: { endpoint: suscripcion.endpoint } });
  await suscripcion.unsubscribe();
}

// Si este celular ya estaba suscrito (por ejemplo, entró otra persona en él),
// se vuelve a registrar para que los avisos le lleguen a quien tiene la sesión.
export async function sincronizarPush() {
  const suscripcion = await suscripcionActual();
  if (suscripcion && Notification.permission === 'granted') {
    await api('/notificaciones/suscripcion', { method: 'POST', cuerpo: suscripcion.toJSON() });
  }
  return Boolean(suscripcion);
}

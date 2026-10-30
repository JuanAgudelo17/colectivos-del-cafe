// Reporte de errores del navegador al backend (POST /api/errores): pantallas que
// se rompen y errores de JavaScript sin atrapar. Al admin le llega un aviso.
// Solo en producción (en desarrollo se ven en la consola). Cada error distinto
// se manda una sola vez por carga de la página.

const enviados = new Set();

// Ruido que no es de la app: extensiones del navegador, avisos internos de Chrome.
const IGNORAR = [/ResizeObserver loop/, /^Script error\.?$/, /extension:\/\//];

export function reportarError(error, { detalle } = {}) {
  if (!import.meta.env.PROD) return;
  const mensaje = String(error?.message ?? error ?? '').slice(0, 500) || 'Error sin mensaje';
  const pila = [error?.stack, detalle].filter(Boolean).join('\n\n').slice(0, 4000);
  if (IGNORAR.some((r) => r.test(mensaje) || r.test(pila))) return;
  // Sin señal, los errores de red no son de la app.
  if (!navigator.onLine) return;
  if (enviados.has(mensaje)) return;
  enviados.add(mensaje);

  // fetch directo (no `api`): no debe renovar la sesión ni disparar "sesión vencida".
  fetch('/api/errores', {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', 'X-Segundo-Plano': '1' },
    body: JSON.stringify({ mensaje, detalle: pila || undefined, ruta: window.location.pathname }),
  }).catch(() => {});
}

// Errores que nadie atrapó (un botón que falla, una promesa rechazada).
export function escucharErrores() {
  window.addEventListener('error', (e) => {
    // Solo los de nuestro sitio (no los de extensiones o scripts de terceros).
    if (e.filename && !e.filename.startsWith(window.location.origin)) return;
    reportarError(e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => reportarError(e.reason));
}

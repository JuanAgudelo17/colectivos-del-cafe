// Service worker de El Producido:
// 1. Notificaciones push: las muestra y abre la app al tocarlas.
// 2. Sin señal: guarda la app (la página, el JS, el CSS, las fuentes) y los
//    datos del conductor (consultas marcadas con X-Sin-Conexion por el frontend).
//    Primero intenta internet; sin red, o si tarda más de unos segundos (señal
//    mala en carretera), muestra lo guardado. Las respuestas guardadas llevan
//    X-Guardado-En para que la app avise "Sin señal: datos del …".
//    Los datos se borran al salir, al vencer la sesión (401) o al entrar con
//    otra cuenta (el frontend borra la caché de datos).

const CACHE_APP = 'el-producido-app-v1';
const CACHE_DATOS = 'el-producido-datos-v1'; // el mismo nombre que en compartido/api.js
const ESPERA_PAGINA_MS = 4000;
const ESPERA_DATOS_MS = 6000;
const VIGENCIA_DATOS_MS = 30 * 24 * 60 * 60 * 1000; // lo guardado de más de 30 días no se muestra
const MAXIMO_ARCHIVOS_APP = 80; // las versiones viejas del JS se van borrando

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_APP)
      .then((cache) => cache.add('/'))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((n) => ![CACHE_APP, CACHE_DATOS].includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Lo que llegue primero: internet o, pasada la espera, lo guardado. Sin red
// (fetch falla de una), lo guardado de inmediato. La respuesta de internet que
// llegue tarde igual actualiza lo guardado.
function redOGuardado(evento, red, guardada, espera) {
  evento.waitUntil(red.catch(() => {}));
  if (!guardada) return red;
  return Promise.race([red, esperar(espera).then(() => guardada)]).catch(() => guardada);
}

// Páginas: siempre la misma app (index.html), guardada en '/'.
async function pagina(evento) {
  const cache = await caches.open(CACHE_APP);
  const red = fetch(evento.request).then(async (res) => {
    if (res.ok) await cache.put('/', res.clone());
    return res;
  });
  return redOGuardado(evento, red, await cache.match('/'), ESPERA_PAGINA_MS);
}

// JS, CSS, imágenes y fuentes: los nombres cambian con cada versión, así que lo
// guardado sirve tal cual.
async function archivo(evento) {
  const cache = await caches.open(CACHE_APP);
  const guardada = await cache.match(evento.request);
  if (guardada) return guardada;
  const res = await fetch(evento.request);
  if (res.ok || res.type === 'opaque') {
    evento.waitUntil(
      cache.put(evento.request, res.clone()).then(async () => {
        const claves = (await cache.keys()).filter((r) => new URL(r.url).pathname !== '/');
        await Promise.all(claves.slice(0, Math.max(0, claves.length - MAXIMO_ARCHIVOS_APP)).map((r) => cache.delete(r)));
      }),
    );
  }
  return res;
}

// Datos del conductor (GET /api con X-Sin-Conexion, y /api/auth/yo si es conductor).
async function datos(evento, url) {
  const cache = await caches.open(CACHE_DATOS);
  const clave = url.href;
  const red = fetch(evento.request).then(async (res) => {
    if (res.status === 401) {
      await caches.delete(CACHE_DATOS);
    } else if (res.ok) {
      const cuerpo = await res.clone().text();
      let deConductor = true;
      if (url.pathname === '/api/auth/yo') {
        try {
          deConductor = JSON.parse(cuerpo).usuario?.rol === 'conductor';
        } catch {
          deConductor = false;
        }
      }
      if (deConductor) {
        const encabezados = new Headers(res.headers);
        encabezados.set('X-Guardado-En', new Date().toISOString());
        encabezados.delete('Set-Cookie');
        encabezados.delete('Vary');
        await cache.put(clave, new Response(cuerpo, { status: 200, headers: encabezados }));
      } else {
        await cache.delete(clave);
      }
    }
    return res;
  });

  let guardada = await cache.match(clave);
  const fecha = guardada && Date.parse(guardada.headers.get('X-Guardado-En'));
  if (guardada && !(Date.now() - fecha < VIGENCIA_DATOS_MS)) guardada = null;
  return redOGuardado(evento, red, guardada, ESPERA_DATOS_MS);
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) {
      if (request.headers.get('X-Sin-Conexion') === '1' || url.pathname === '/api/auth/yo') {
        evento.respondWith(datos(evento, url));
      }
      return;
    }
    if (request.mode === 'navigate') return evento.respondWith(pagina(evento));
    if (url.pathname.startsWith('/assets/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
      evento.respondWith(archivo(evento));
    }
    return;
  }

  // La fuente Inter (Google Fonts).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    evento.respondWith(archivo(evento));
  }
});

// ---- Notificaciones push --------------------------------------------------------

self.addEventListener('push', (evento) => {
  let datos;
  try {
    datos = evento.data?.json() ?? {};
  } catch {
    datos = { cuerpo: evento.data?.text() };
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo ?? 'El Producido', {
      body: datos.cuerpo ?? '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      tag: datos.clave,
      data: { url: datos.url ?? '/' },
    }),
  );
});

// Al tocar la notificación: si la app ya está abierta, la lleva a la página del
// aviso; si no, la abre.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url ?? '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) return abierta.navigate(url).then((v) => (v ?? abierta).focus());
      return self.clients.openWindow(url);
    }),
  );
});

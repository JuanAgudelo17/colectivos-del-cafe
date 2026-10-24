// Service worker de El Producido: solo recibe notificaciones push y abre la app
// al tocarlas. No guarda nada en caché (la app siempre se carga de internet).

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

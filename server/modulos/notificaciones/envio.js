import webpush from 'web-push';

// Envío de notificaciones push con las claves VAPID del entorno
// (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY; se crean con `npm run claves-push`).
// Sin claves no se envía nada, pero los avisos igual quedan en la campanita.
// En las pruebas se usa un enviador falso con la misma forma.
export function enviadorDesdeEntorno() {
  const {
    VAPID_PUBLIC_KEY: publica,
    VAPID_PRIVATE_KEY: privada,
    VAPID_SUBJECT: sujeto = 'https://el-producido.netlify.app',
  } = process.env;

  if (!publica || !privada) {
    return { configurado: false, clavePublica: null, enviar: async () => 'sin-configurar' };
  }

  webpush.setVapidDetails(sujeto, publica, privada);
  return {
    configurado: true,
    clavePublica: publica,
    // 'enviada' | 'vencida' (el celular ya no acepta: hay que borrar la suscripción) | 'error'
    async enviar(suscripcion, datos) {
      try {
        await webpush.sendNotification(
          { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
          JSON.stringify(datos),
          { TTL: 24 * 60 * 60 },
        );
        return 'enviada';
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) return 'vencida';
        console.error('Push: no se pudo enviar', err.statusCode ?? err.message);
        return 'error';
      }
    },
  };
}

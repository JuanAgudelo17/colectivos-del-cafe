// Crea las claves VAPID de las notificaciones push y las agrega al .env de la
// raíz. Nunca las muestra en pantalla. Si ya existen no las cambia: los
// celulares suscritos dependen de ellas. Uso: npm run claves-push
import fs from 'node:fs';
import webpush from 'web-push';

const ruta = new URL('../../.env', import.meta.url);
const actual = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';

if (/^VAPID_PRIVATE_KEY=.+/m.test(actual)) {
  console.log('Ya hay claves VAPID en .env; no se cambian.');
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  const separador = actual === '' || actual.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(
    ruta,
    `${actual}${separador}\n# Notificaciones push (npm run claves-push)\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`,
  );
  console.log('✔ Claves VAPID agregadas a .env. Cárgalas también en Netlify (la privada como secreta).');
}

// Archivos en Supabase Storage (buckets privados) a través de su API REST.
// Las imágenes nunca se sirven públicas: se muestran con URLs firmadas de corta duración.
//
// Interfaz de un almacén (la misma en Supabase y en memoria para las pruebas):
//   subir(bucket, ruta, contenido: Buffer, tipo)   borrar(bucket, ruta)
//   urlFirmada(bucket, ruta, segundos) → URL absoluta
import { ErrorHttp } from './http/errores.js';

export function crearAlmacenSupabase({ url, clave }) {
  // Acepta la URL del proyecto aunque se copie con /rest/v1/ (la de la Data API).
  const base = `${url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')}/storage/v1`;
  const cabeceras = { Authorization: `Bearer ${clave}`, apikey: clave };

  async function pedir(ruta, opciones) {
    let res;
    try {
      res = await fetch(`${base}${ruta}`, { ...opciones, headers: { ...cabeceras, ...opciones.headers } });
    } catch (err) {
      throw new Error(`Supabase Storage no responde: ${err.message}`);
    }
    if (!res.ok) throw new Error(`Supabase Storage respondió ${res.status}: ${await res.text()}`);
    return res.json().catch(() => null);
  }

  return {
    subir: (bucket, ruta, contenido, tipo) =>
      pedir(`/object/${bucket}/${ruta}`, { method: 'POST', headers: { 'Content-Type': tipo }, body: contenido }),

    borrar: (bucket, ruta) =>
      pedir(`/object/${bucket}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [ruta] }),
      }),

    async urlFirmada(bucket, ruta, segundos) {
      const { signedURL } = await pedir(`/object/sign/${bucket}/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: segundos }),
      });
      return `${base}${signedURL}`;
    },

    // Crea el bucket privado si no existe (lo usa scripts/crear-buckets.js).
    async crearBucket(bucket, { tiposPermitidos, limiteBytes }) {
      try {
        await pedir('/bucket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: bucket,
            name: bucket,
            public: false,
            allowed_mime_types: tiposPermitidos,
            file_size_limit: limiteBytes,
          }),
        });
        return true;
      } catch (err) {
        if (/already exists|Duplicate/i.test(err.message)) return false;
        throw err;
      }
    },
  };
}

// Almacén con las variables de entorno. Si faltan, falla solo al usarlo
// (así el resto de la API sigue funcionando sin Storage configurado).
export function almacenDesdeEntorno() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: clave } = process.env;
  if (url && clave) return crearAlmacenSupabase({ url, clave });

  const sinConfigurar = async () => {
    throw new ErrorHttp(503, 'El almacenamiento de imágenes no está configurado');
  };
  return { subir: sinConfigurar, borrar: sinConfigurar, urlFirmada: sinConfigurar };
}

// Buckets privados de la app (los crea `npm run crear-buckets`).
export const BUCKETS = ['busetas', 'facturas'];

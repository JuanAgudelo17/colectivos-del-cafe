import { noEncontrado } from '../../compartido/http/errores.js';
import { validarImagen } from '../../compartido/http/imagenes.js';
import { cambiarFoto } from './repositorio.js';

export const BUCKET_FOTOS = 'busetas';
const DURACION_URL = 10 * 60; // segundos

// Responde con una redirección a la URL firmada de la foto (el bucket es privado).
// El navegador puede guardar la redirección unos minutos: menos que lo que dura la firma.
export async function redirigirAFoto(req, res, buseta) {
  if (!buseta?.foto) throw noEncontrado('La foto');
  const url = await req.app.locals.almacen.urlFirmada(BUCKET_FOTOS, buseta.foto, DURACION_URL);
  res.set('Cache-Control', 'private, max-age=300');
  res.redirect(302, url);
}

// Sube la foto nueva (nombre único, así no hay caché vieja) y borra la anterior.
export async function reemplazarFoto(req, buseta) {
  const { db, almacen } = req.app.locals;
  const { ext, tipo, contenido } = validarImagen(req);
  const ruta = `${buseta.id}/${Date.now()}.${ext}`;

  await almacen.subir(BUCKET_FOTOS, ruta, contenido, tipo);
  await borrarArchivo(almacen, await cambiarFoto(db, buseta.id, ruta));
}

export async function quitarFoto(req, buseta) {
  const { db, almacen } = req.app.locals;
  await borrarArchivo(almacen, await cambiarFoto(db, buseta.id, null));
}

// Si el archivo viejo no se puede borrar solo queda huérfano en el bucket:
// no vale la pena fallar la petición por eso.
async function borrarArchivo(almacen, ruta) {
  if (!ruta) return;
  try {
    await almacen.borrar(BUCKET_FOTOS, ruta);
  } catch (err) {
    console.error(`No se pudo borrar la foto ${ruta}:`, err.message);
  }
}

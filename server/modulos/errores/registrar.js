import { createHash } from 'node:crypto';
import { hoyBogota } from '../../compartido/fecha.js';
import { enviadorDesdeEntorno, notificar } from '../notificaciones/index.js';
import { adminsActivos, guardarError } from './repositorio.js';

const recortar = (texto, max) => (texto == null ? null : String(texto).slice(0, max));

// Huella del error: el mismo error en el mismo lugar es uno solo (se cuenta).
// Los números largos (ids, valores) no cuentan, así "buseta 3" y "buseta 7" son el mismo.
export function huellaDe({ origen, ruta, mensaje }) {
  const normalizado = String(mensaje).split('\n')[0].replace(/\d{2,}/g, '#').slice(0, 300);
  return createHash('sha256').update(`${origen}|${ruta ?? ''}|${normalizado}`).digest('hex').slice(0, 32);
}

// Guarda un error de la app y les avisa a los admin (campanita y push), a lo
// sumo una vez al día por cada error. Nunca lanza: si falla (ej. la base está
// caída), solo lo deja en el log. Lo de la base caída lo detecta aparte la
// revisión diaria de GitHub (mantener-activo.yml).
// `datos`: { origen: 'servidor'|'navegador'|'programada', mensaje, detalle?, ruta?, usuarioId?, navegador? }
export async function registrarError(db, datos, { enviador = enviadorDesdeEntorno() } = {}) {
  try {
    const error = await guardarError(db, {
      ...datos,
      mensaje: recortar(datos.mensaje || 'Error sin mensaje', 500),
      detalle: recortar(datos.detalle, 4000),
      ruta: recortar(datos.ruta, 300),
      navegador: recortar(datos.navegador, 300),
      huella: huellaDe(datos),
    });
    const admins = await adminsActivos(db);
    const lugar = error.ruta ? ` · ${error.ruta}` : '';
    await notificar(
      db,
      admins.map((usuarioId) => ({
        usuarioId,
        clave: `error:${error.id}:${hoyBogota()}`,
        tipo: 'error',
        titulo: error.origen === 'navegador' ? 'Error en la app (celular o navegador)' : 'Error en el servidor',
        cuerpo: `${error.mensaje.slice(0, 140)}${lugar}`,
        url: '/admin/errores',
      })),
      { enviador },
    );
    return error;
  } catch (err) {
    console.error('No se pudo registrar el error', err?.message ?? err);
    return null;
  }
}

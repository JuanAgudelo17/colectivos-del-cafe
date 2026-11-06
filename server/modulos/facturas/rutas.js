import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { recibirImagen, validarImagen } from '../../compartido/http/imagenes.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta } from '../busetas/index.js';
import { mesCerrado, rangoDelMes } from '../producido/index.js';
import { consultaEsquema, facturaEsquema } from './esquemas.js';
import { borrarFactura, cambiarImagen, crearFactura, listarFacturas, obtenerFactura } from './repositorio.js';

const router = Router();
router.use(autenticar, requiereRol('admin', 'conductor'));

export const BUCKET_FACTURAS = 'facturas';
const DURACION_URL = 10 * 60; // segundos
export const DIAS_EDICION = 7;

// El admin maneja todas; el conductor, las de su buseta que él registró y
// solo durante 7 días (después quedan como soporte y las corrige el admin).
function puedeEditar(usuario, factura, ahora = new Date()) {
  if (usuario.rol === 'admin') return true;
  const edad = ahora - new Date(factura.creadoEn);
  return factura.conductorId === usuario.id && factura.busetaId === usuario.busetaId && edad <= DIAS_EDICION * 86_400_000;
}

const conPermiso = (usuario) => ({ imagenPath, ...f }) => ({ ...f, tieneFoto: Boolean(imagenPath), editable: puedeEditar(usuario, f) });

// La factura del id, si quien pregunta la puede ver (el conductor, solo las de su buseta).
async function facturaVisible(req) {
  const factura = await obtenerFactura(req.app.locals.db, idDeRuta(req));
  const { busetaId } = alcance(req.usuario);
  if (!factura || (busetaId !== null && factura.busetaId !== busetaId)) throw noEncontrado('La factura');
  return factura;
}

async function facturaEditable(req) {
  const factura = await facturaVisible(req);
  if (!puedeEditar(req.usuario, factura)) {
    throw new ErrorHttp(403, `Solo puedes cambiar o borrar las facturas que registraste en los últimos ${DIAS_EDICION} días`);
  }
  await verificarMesAbierto(req.app.locals.db, factura.busetaId, factura.fecha);
  return factura;
}

async function verificarMesAbierto(db, busetaId, fecha) {
  if (await mesCerrado(db, busetaId, Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)))) {
    throw new ErrorHttp(409, 'Ese mes ya está cerrado: no se pueden agregar ni cambiar facturas');
  }
}

// Si el archivo viejo no se puede borrar solo queda huérfano en el bucket.
async function borrarArchivo(almacen, ruta) {
  if (!ruta) return;
  try {
    await almacen.borrar(BUCKET_FACTURAS, ruta);
  } catch (err) {
    console.error(`No se pudo borrar la foto de la factura ${ruta}:`, err.message);
  }
}

// Facturas del mes: el conductor, las de su buseta; el admin, las de una buseta o todas.
router.get('/', async (req, res) => {
  const { anio, mes, busetaId: elegida } = validar(consultaEsquema, req.query);
  const { busetaId } = alcance(req.usuario);
  if (req.usuario.rol === 'conductor' && !busetaId) return res.json({ facturas: [], total: 0, diasEdicion: DIAS_EDICION });

  const { desde, hasta } = rangoDelMes(anio, mes);
  const facturas = (await listarFacturas(req.app.locals.db, { desde, hasta, busetaId: busetaId ?? elegida ?? null })).map(
    conPermiso(req.usuario),
  );
  res.json({ facturas, total: facturas.reduce((t, f) => t + f.precio, 0), diasEdicion: DIAS_EDICION });
});

router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const datos = validar(facturaEsquema, req.body);
  let busetaId;
  let conductorId;
  if (req.usuario.rol === 'conductor') {
    busetaId = req.usuario.busetaId;
    conductorId = req.usuario.id;
    if (!busetaId) throw new ErrorHttp(400, 'Todavía no tienes buseta asignada');
  } else {
    if (!datos.busetaId) throw new ErrorHttp(400, 'Elige la buseta', { busetaId: 'Elige la buseta' });
    const buseta = await obtenerBuseta(db, datos.busetaId);
    if (!buseta) throw noEncontrado('La buseta');
    if (!buseta.conductor) throw new ErrorHttp(400, 'Esa buseta no tiene conductor asignado');
    busetaId = buseta.id;
    conductorId = buseta.conductor.id;
  }
  await verificarMesAbierto(db, busetaId, datos.fecha);
  const factura = await crearFactura(db, { ...datos, busetaId, conductorId });
  res.status(201).json({ factura: conPermiso(req.usuario)(factura) });
});

// ---- Foto (la imagen va en el cuerpo, ya comprimida en el navegador) ----------
router.get('/:id/foto', async (req, res) => {
  const factura = await facturaVisible(req);
  if (!factura.imagenPath) throw noEncontrado('La foto');
  const url = await req.app.locals.almacen.urlFirmada(BUCKET_FACTURAS, factura.imagenPath, DURACION_URL);
  res.set('Cache-Control', 'private, max-age=300');
  res.redirect(302, url);
});

router.put('/:id/foto', recibirImagen, async (req, res) => {
  const { db, almacen } = req.app.locals;
  const factura = await facturaEditable(req);
  const { ext, tipo, contenido } = validarImagen(req);
  // Nombre único: así no queda en caché la foto anterior.
  const ruta = `${factura.busetaId}/${factura.id}-${Date.now()}.${ext}`;
  await almacen.subir(BUCKET_FACTURAS, ruta, contenido, tipo);
  await borrarArchivo(almacen, await cambiarImagen(db, factura.id, ruta));
  res.json({ factura: conPermiso(req.usuario)(await obtenerFactura(db, factura.id)) });
});

router.delete('/:id', async (req, res) => {
  const { db, almacen } = req.app.locals;
  const factura = await facturaEditable(req);
  await borrarFactura(db, factura.id);
  await borrarArchivo(almacen, factura.imagenPath);
  res.status(204).end();
});

export default router;

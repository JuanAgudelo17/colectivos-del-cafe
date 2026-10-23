import { Router } from 'express';
import { noEncontrado } from '../../compartido/http/errores.js';
import { recibirImagen } from '../../compartido/http/imagenes.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { busetaCrear, busetaEditar } from './esquemas.js';
import { quitarFoto, redirigirAFoto, reemplazarFoto } from './foto.js';
import { actualizarBuseta, crearBuseta, listarBusetas, obtenerBuseta } from './repositorio.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

router.get('/', async (req, res) => {
  res.json({ busetas: await listarBusetas(req.app.locals.db) });
});

router.post('/', async (req, res) => {
  const datos = validar(busetaCrear, req.body);
  res.status(201).json({ buseta: await crearBuseta(req.app.locals.db, datos) });
});

async function busetaDeRuta(req) {
  const buseta = await obtenerBuseta(req.app.locals.db, idDeRuta(req));
  if (!buseta) throw noEncontrado('La buseta');
  return buseta;
}

router.get('/:id', async (req, res) => {
  res.json({ buseta: await busetaDeRuta(req) });
});

router.put('/:id', async (req, res) => {
  const datos = validar(busetaEditar, req.body);
  const buseta = await actualizarBuseta(req.app.locals.db, idDeRuta(req), datos);
  if (!buseta) throw noEncontrado('La buseta');
  res.json({ buseta });
});

// ---- Foto (la imagen va en el cuerpo, ya comprimida en el navegador) ----------
router.get('/:id/foto', async (req, res) => {
  await redirigirAFoto(req, res, await busetaDeRuta(req));
});

router.put('/:id/foto', recibirImagen, async (req, res) => {
  const buseta = await busetaDeRuta(req);
  await reemplazarFoto(req, buseta);
  res.json({ buseta: await obtenerBuseta(req.app.locals.db, buseta.id) });
});

router.delete('/:id/foto', async (req, res) => {
  const buseta = await busetaDeRuta(req);
  await quitarFoto(req, buseta);
  res.json({ buseta: await obtenerBuseta(req.app.locals.db, buseta.id) });
});

export default router;

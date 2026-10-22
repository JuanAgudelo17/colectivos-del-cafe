import { Router } from 'express';
import { noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { busetaCrear, busetaEditar } from './esquemas.js';
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

router.get('/:id', async (req, res) => {
  const buseta = await obtenerBuseta(req.app.locals.db, idDeRuta(req));
  if (!buseta) throw noEncontrado('La buseta');
  res.json({ buseta });
});

router.put('/:id', async (req, res) => {
  const datos = validar(busetaEditar, req.body);
  const buseta = await actualizarBuseta(req.app.locals.db, idDeRuta(req), datos);
  if (!buseta) throw noEncontrado('La buseta');
  res.json({ buseta });
});

export default router;

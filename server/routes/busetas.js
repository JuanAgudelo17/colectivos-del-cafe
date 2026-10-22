import { Router } from 'express';
import { actualizarBuseta, crearBuseta, listarBusetas, obtenerBuseta } from '../db/busetas.js';
import { obtenerEmpresa } from '../db/empresas.js';
import { ErrorHttp, noEncontrado } from '../lib/errores.js';
import { busetaCrear, busetaEditar } from '../lib/esquemas.js';
import { idDeRuta, validar } from '../lib/validacion.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { empresaDelListado, verificarAccesoEmpresa } from '../middleware/empresa.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

router.get('/', async (req, res) => {
  const busetas = await listarBusetas(req.app.locals.db, empresaDelListado(req));
  res.json({ busetas });
});

router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const datos = validar(busetaCrear, req.body);
  verificarAccesoEmpresa(req.usuario, datos.empresaId);

  const empresa = await obtenerEmpresa(db, datos.empresaId);
  if (!empresa?.activo) {
    throw new ErrorHttp(400, 'La empresa no existe o está inactiva', { empresaId: 'Elige una empresa activa' });
  }

  res.status(201).json({ buseta: await crearBuseta(db, datos) });
});

// Carga la buseta de la URL y verifica que el admin tenga acceso a su empresa.
async function busetaAccesible(req) {
  const buseta = await obtenerBuseta(req.app.locals.db, idDeRuta(req));
  if (!buseta) throw noEncontrado('La buseta');
  verificarAccesoEmpresa(req.usuario, buseta.empresaId);
  return buseta;
}

router.get('/:id', async (req, res) => {
  res.json({ buseta: await busetaAccesible(req) });
});

// La empresa de una buseta no se cambia: evita mezclar históricos entre empresas.
router.put('/:id', async (req, res) => {
  const actual = await busetaAccesible(req);
  const datos = validar(busetaEditar, req.body);
  const buseta = await actualizarBuseta(req.app.locals.db, actual.id, datos);
  res.json({ buseta });
});

export default router;

import { Router } from 'express';
import { actualizarEmpresa, crearEmpresa, listarEmpresas, obtenerEmpresa } from '../db/empresas.js';
import { noEncontrado, prohibido } from '../lib/errores.js';
import { empresaCrear, empresaEditar } from '../lib/esquemas.js';
import { idDeRuta, validar } from '../lib/validacion.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { alcance, verificarAccesoEmpresa } from '../middleware/empresa.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

router.get('/', async (req, res) => {
  const empresas = await listarEmpresas(req.app.locals.db, alcance(req.usuario).empresaId);
  res.json({ empresas });
});

// Solo el admin global crea empresas.
router.post('/', async (req, res) => {
  if (req.usuario.empresaId !== null) throw prohibido();
  const datos = validar(empresaCrear, req.body);
  const empresa = await crearEmpresa(req.app.locals.db, datos);
  res.status(201).json({ empresa });
});

router.put('/:id', async (req, res) => {
  const id = idDeRuta(req);
  verificarAccesoEmpresa(req.usuario, id);
  const datos = validar(empresaEditar, req.body);
  const empresa = await actualizarEmpresa(req.app.locals.db, id, datos);
  if (!empresa) throw noEncontrado('La empresa');
  res.json({ empresa });
});

router.get('/:id', async (req, res) => {
  const id = idDeRuta(req);
  verificarAccesoEmpresa(req.usuario, id);
  const empresa = await obtenerEmpresa(req.app.locals.db, id);
  if (!empresa) throw noEncontrado('La empresa');
  res.json({ empresa });
});

export default router;

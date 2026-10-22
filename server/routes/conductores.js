import { Router } from 'express';
import { obtenerBuseta } from '../db/busetas.js';
import {
  actualizarConductor,
  cambiarPassword,
  crearConductor,
  listarConductores,
  obtenerConductor,
} from '../db/conductores.js';
import { obtenerEmpresa } from '../db/empresas.js';
import { limpiarFallos } from '../db/intentosLogin.js';
import { ErrorHttp, noEncontrado } from '../lib/errores.js';
import { conductorCrear, conductorEditar } from '../lib/esquemas.js';
import { generarPassword, hashPassword } from '../lib/passwords.js';
import { idDeRuta, validar } from '../lib/validacion.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { empresaDelListado, verificarAccesoEmpresa } from '../middleware/empresa.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

// La buseta a asignar debe existir, estar activa y ser de la misma empresa.
async function validarBuseta(db, busetaId, empresaId) {
  if (busetaId === null) return;
  const buseta = await obtenerBuseta(db, busetaId);
  if (!buseta || buseta.empresaId !== empresaId || !buseta.activo) {
    const mensaje = 'Elige una buseta activa de la misma empresa';
    throw new ErrorHttp(400, mensaje, { busetaId: mensaje });
  }
}

async function conductorAccesible(req) {
  const conductor = await obtenerConductor(req.app.locals.db, idDeRuta(req));
  if (!conductor) throw noEncontrado('El conductor');
  verificarAccesoEmpresa(req.usuario, conductor.empresaId);
  return conductor;
}

router.get('/', async (req, res) => {
  const conductores = await listarConductores(req.app.locals.db, empresaDelListado(req));
  res.json({ conductores });
});

// Devuelve la contraseña inicial UNA sola vez; en la BD solo queda el hash.
router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const datos = validar(conductorCrear, req.body);
  verificarAccesoEmpresa(req.usuario, datos.empresaId);

  const empresa = await obtenerEmpresa(db, datos.empresaId);
  if (!empresa?.activo) {
    throw new ErrorHttp(400, 'La empresa no existe o está inactiva', { empresaId: 'Elige una empresa activa' });
  }
  await validarBuseta(db, datos.busetaId, datos.empresaId);

  const password = generarPassword();
  const conductor = await crearConductor(db, datos, await hashPassword(password));
  res.status(201).json({ conductor, password });
});

router.get('/:id', async (req, res) => {
  res.json({ conductor: await conductorAccesible(req) });
});

// La empresa de un conductor no se cambia.
router.put('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const actual = await conductorAccesible(req);
  const datos = validar(conductorEditar, req.body);
  if (datos.busetaId !== actual.busetaId) await validarBuseta(db, datos.busetaId, actual.empresaId);

  res.json({ conductor: await actualizarConductor(db, actual.id, datos) });
});

router.post('/:id/restablecer-password', async (req, res) => {
  const db = req.app.locals.db;
  const conductor = await conductorAccesible(req);
  const password = generarPassword();
  await cambiarPassword(db, conductor.id, await hashPassword(password));
  await limpiarFallos(db, conductor.usuario);
  res.json({ password });
});

export default router;

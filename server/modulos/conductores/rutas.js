import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { generarPassword, hashPassword } from '../../compartido/seguridad/passwords.js';
import { asignarPasswordTemporal, limpiarFallos } from '../auth/index.js';
import { obtenerBuseta } from '../busetas/index.js';
import { conductorCrear, conductorEditar } from './esquemas.js';
import { actualizarConductor, crearConductor, listarConductores, obtenerConductor } from './repositorio.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

// La buseta a asignar debe existir y estar activa.
async function validarBuseta(db, busetaId) {
  if (busetaId === null) return;
  const buseta = await obtenerBuseta(db, busetaId);
  if (!buseta?.activo) {
    const mensaje = 'Elige una buseta activa';
    throw new ErrorHttp(400, mensaje, { busetaId: mensaje });
  }
}

async function conductorDeRuta(req) {
  const conductor = await obtenerConductor(req.app.locals.db, idDeRuta(req));
  if (!conductor) throw noEncontrado('El conductor');
  return conductor;
}

router.get('/', async (req, res) => {
  res.json({ conductores: await listarConductores(req.app.locals.db) });
});

// Devuelve la contraseña temporal UNA sola vez; en la BD solo queda el hash.
// El conductor la usa para entrar y crear la suya.
router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const datos = validar(conductorCrear, req.body);
  await validarBuseta(db, datos.busetaId);

  const password = generarPassword();
  const conductor = await crearConductor(db, datos, await hashPassword(password));
  res.status(201).json({ conductor, password });
});

router.get('/:id', async (req, res) => {
  res.json({ conductor: await conductorDeRuta(req) });
});

router.put('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const actual = await conductorDeRuta(req);
  const datos = validar(conductorEditar, req.body);
  if (datos.busetaId !== actual.busetaId) await validarBuseta(db, datos.busetaId);

  res.json({ conductor: await actualizarConductor(db, actual.id, datos) });
});

// Nueva contraseña temporal (también atiende su solicitud de recuperación, si hay).
router.post('/:id/restablecer-password', async (req, res) => {
  const db = req.app.locals.db;
  const conductor = await conductorDeRuta(req);
  const password = generarPassword();
  await asignarPasswordTemporal(db, conductor.id, await hashPassword(password), req.usuario.id);
  await limpiarFallos(db, conductor.usuario);
  res.json({ password });
});

export default router;

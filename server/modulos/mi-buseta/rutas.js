import { Router } from 'express';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta, redirigirAFoto } from '../busetas/index.js';

const router = Router();
router.use(autenticar, requiereRol('conductor'));

// Nunca recibe un id: el alcance sale de la sesión, así nunca ve otra buseta.
const miBuseta = (req) => {
  const { busetaId } = alcance(req.usuario);
  return busetaId ? obtenerBuseta(req.app.locals.db, busetaId) : null;
};

// La buseta asignada al conductor que pregunta y el estado de sus documentos.
// No expone el valor del arriendo (dato administrativo). El mantenimiento
// se consulta en /api/mantenimiento/:busetaId.
router.get('/', async (req, res) => {
  const buseta = await miBuseta(req);
  if (!buseta) return res.json({ buseta: null });

  const { id, numeroInterno, placa, modelo, tieneCupo, activo, foto, documentos } = buseta;
  res.json({ buseta: { id, numeroInterno, placa, modelo, tieneCupo, activo, foto, documentos } });
});

router.get('/foto', async (req, res) => {
  await redirigirAFoto(req, res, await miBuseta(req));
});

export default router;

import { Router } from 'express';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta } from '../busetas/index.js';

const router = Router();
router.use(autenticar, requiereRol('conductor'));

// La buseta asignada al conductor que pregunta y el estado de sus documentos.
// No recibe ningún id: el alcance sale de la sesión, así nunca ve otra buseta.
// Tampoco expone el valor del arriendo (dato administrativo).
router.get('/', async (req, res) => {
  const { busetaId } = alcance(req.usuario);
  const buseta = busetaId && (await obtenerBuseta(req.app.locals.db, busetaId));

  if (!buseta) return res.json({ buseta: null });

  const { id, numeroInterno, placa, modelo, tieneCupo, activo, documentos } = buseta;
  res.json({ buseta: { id, numeroInterno, placa, modelo, tieneCupo, activo, documentos } });
});

export default router;

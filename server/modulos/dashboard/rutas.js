import { Router } from 'express';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarPendientes } from '../auth/index.js';
import { listarBusetas } from '../busetas/index.js';
import { listarConductores } from '../conductores/index.js';
import { estadoDeLaFlota } from '../mantenimiento/index.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

// Lo mismo que GET /busetas, /conductores, /mantenimiento y /auth/solicitudes, junto.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const [busetas, conductores, mantenimiento, solicitudes] = await Promise.all([
    listarBusetas(db),
    listarConductores(db),
    estadoDeLaFlota(db),
    listarPendientes(db),
  ]);
  res.json({ busetas, conductores, mantenimiento, solicitudes });
});

export default router;

import { Router } from 'express';
import { ahoraBogota } from '../lib/fecha.js';

const router = Router();

// Diagnóstico rápido del despliegue. Solo dice si la configuración está bien,
// nunca muestra valores de variables ni detalles del error.
router.get('/', async (req, res) => {
  const jwt = (process.env.JWT_SECRET?.length ?? 0) >= 32 ? 'ok' : 'falta o tiene menos de 32 caracteres';

  let baseDatos = 'sin configurar';
  const db = req.app.locals.db;
  if (db) {
    try {
      await db.query('SELECT 1');
      baseDatos = 'ok';
    } catch (err) {
      console.error('Salud: no se pudo conectar a la base de datos', err);
      baseDatos = 'error de conexión (ver Logs → Functions)';
    }
  }

  res.json({ ok: jwt === 'ok' && baseDatos === 'ok', hora: ahoraBogota(), jwt, baseDatos });
});

export default router;

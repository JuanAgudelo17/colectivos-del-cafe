import { Router } from 'express';
import { validar } from '../../compartido/http/validacion.js';
import { mesActualBogota } from '../../compartido/fecha.js';
import { autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarBusetas } from '../busetas/index.js';
import { datosDelAnio, parametrosDelMes, primerAnio, rangoDelMes } from '../producido/index.js';
import { armarAnio } from './calculo.js';
import { anioConsulta } from './esquemas.js';

const router = Router();
router.use(autenticar, requiereRol('admin'));

// Rentabilidad de un año (por defecto el actual): cada buseta mes a mes y la flota.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const mesActual = mesActualBogota();
  const { anio = mesActual.anio } = validar(anioConsulta, req.query);

  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const [busetas, { dias, ajustes }, parametros, primero] = await Promise.all([
    listarBusetas(db),
    datosDelAnio(db, anio),
    Promise.all(meses.map((mes) => parametrosDelMes(db, rangoDelMes(anio, mes).hasta))),
    primerAnio(db),
  ]);

  const resultado = armarAnio({
    anio,
    mesActual,
    busetas,
    dias,
    ajustes,
    parametrosPorMes: Object.fromEntries(meses.map((mes, i) => [mes, parametros[i]])),
  });

  // Años con datos (del primero al actual, el más reciente primero) para el selector.
  const desde = Math.min(primero ?? mesActual.anio, mesActual.anio);
  const anios = Array.from({ length: mesActual.anio - desde + 1 }, (_, i) => mesActual.anio - i);

  res.json({
    ...resultado,
    anios,
    mesActual,
    busetas: resultado.busetas.map(({ buseta: b, meses: delAnio, total }) => ({
      id: b.id,
      numeroInterno: b.numeroInterno,
      placa: b.placa,
      tieneCupo: b.tieneCupo,
      activo: b.activo,
      conductor: b.conductor?.nombre ?? null,
      meses: delAnio,
      total,
    })),
  });
});

export default router;

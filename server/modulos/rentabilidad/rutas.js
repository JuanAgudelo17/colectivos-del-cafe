import { Router } from 'express';
import { validar } from '../../compartido/http/validacion.js';
import { hoyBogota, mesActualBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { listarBusetas } from '../busetas/index.js';
import { datosDelAnio, parametrosDelMes, primerAnio, rangoDelMes } from '../producido/index.js';
import { armarAnio } from './calculo.js';
import { anioConsulta } from './esquemas.js';
import { proyectarMes } from './proyeccion.js';

const router = Router();

// Rentabilidad de un año de las busetas que pase el filtro, con los años que
// tienen datos (del primero al actual, el más reciente primero) para el selector.
async function calcularAnio(db, anio, mesActual, filtro = () => true) {
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
    busetas: busetas.filter(filtro),
    dias,
    ajustes,
    parametrosPorMes: Object.fromEntries(meses.map((mes, i) => [mes, parametros[i]])),
  });

  const desde = Math.min(primero ?? mesActual.anio, mesActual.anio);
  const anios = Array.from({ length: mesActual.anio - desde + 1 }, (_, i) => mesActual.anio - i);
  return { resultado, anios };
}

// ---- Conductor: la rentabilidad de su buseta (nunca la de otras) ---------------
router.get('/mia', autenticar, requiereRol('conductor'), async (req, res) => {
  const db = req.app.locals.db;
  const mesActual = mesActualBogota();
  const { anio = mesActual.anio } = validar(anioConsulta, req.query);
  const { busetaId } = alcance(req.usuario);
  if (!busetaId) return res.json({ buseta: null, anio, anios: [anio] });

  const { resultado, anios } = await calcularAnio(db, anio, mesActual, (b) => b.id === busetaId);
  const suya = resultado.busetas[0];
  if (!suya) return res.json({ buseta: null, anio, anios });

  // Proyección del cierre solo para el mes en curso.
  const enCurso = suya.meses.find((m) => m.enCurso);
  const proyeccion =
    enCurso &&
    proyectarMes(enCurso, {
      diasDelMes: rangoDelMes(anio, enCurso.mes).ultimoDia,
      diaDeHoy: Number(hoyBogota().slice(8)),
      tieneCupo: suya.buseta.tieneCupo,
    });

  res.json({
    anio,
    anios,
    mesActual,
    ultimoMes: resultado.ultimoMes,
    buseta: { numeroInterno: suya.buseta.numeroInterno, placa: suya.buseta.placa, tieneCupo: suya.buseta.tieneCupo },
    meses: suya.meses,
    total: suya.total,
    proyeccion: proyeccion ?? null,
  });
});

// ---- Admin --------------------------------------------------------------------
router.use(autenticar, requiereRol('admin'));

// Rentabilidad de un año (por defecto el actual): cada buseta mes a mes y la flota.
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const mesActual = mesActualBogota();
  const { anio = mesActual.anio } = validar(anioConsulta, req.query);
  const { resultado, anios } = await calcularAnio(db, anio, mesActual);

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

import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta } from '../busetas/index.js';
import { calcularResumen } from './calculo.js';
import { ajusteEsquema, diaEsquema, mesConsulta, rutaEsquema } from './esquemas.js';
import {
  actualizarRuta,
  borrarAjuste,
  borrarDia,
  crearAjuste,
  guardarDia,
  listarAjustes,
  listarDias,
  listarRutas,
  mesCerrado,
  obtenerAjuste,
  parametrosDelMes,
  rangoDelMes,
} from './repositorio.js';

const router = Router();

// ---- Conductor: solo consulta lo suyo -----------------------------------------
// Producido, peajes, salidas y ACPM de cada día y sus totales. Nunca el 20 %,
// el fondo, los préstamos ni el neto.
router.get('/mio', autenticar, requiereRol('conductor'), async (req, res) => {
  const db = req.app.locals.db;
  const { anio, mes } = validar(mesConsulta, req.query);
  const { busetaId, conductorId } = alcance(req.usuario);
  const buseta = busetaId && (await obtenerBuseta(db, busetaId));
  if (!buseta) return res.json({ buseta: null, anio, mes, dias: [], totales: null });

  const { desde, hasta } = rangoDelMes(anio, mes);
  const dias = (await listarDias(db, busetaId, desde, hasta, conductorId)).map(
    ({ fecha, ingreso, peajes, salidas, acpm, relevo }) => ({ fecha, ingreso, peajes, salidas, acpm, relevo }),
  );
  const sumar = (campo) => dias.reduce((t, d) => t + d[campo], 0);

  res.json({
    buseta: { numeroInterno: buseta.numeroInterno, placa: buseta.placa },
    anio,
    mes,
    dias,
    totales: {
      ingreso: sumar('ingreso'),
      peajes: sumar('peajes'),
      salidas: sumar('salidas'),
      acpm: sumar('acpm'),
      diasTrabajados: dias.filter((d) => d.ingreso > 0).length,
    },
  });
});

// ---- Admin --------------------------------------------------------------------
router.use(autenticar, requiereRol('admin'));

// Tarifas de las rutas (para proponer peajes y salidas según las vueltas).
router.get('/rutas', async (req, res) => {
  res.json({ rutas: await listarRutas(req.app.locals.db) });
});

router.put('/rutas/:id', async (req, res) => {
  const datos = validar(rutaEsquema, req.body);
  const ruta = await actualizarRuta(req.app.locals.db, idDeRuta(req), datos);
  if (!ruta) throw noEncontrado('La ruta');
  res.json({ ruta });
});

async function busetaDeRuta(req, param = 'busetaId') {
  const buseta = await obtenerBuseta(req.app.locals.db, idDeRuta(req, param));
  if (!buseta) throw noEncontrado('La buseta');
  return buseta;
}

async function verificarMesAbierto(db, busetaId, anio, mes) {
  if (await mesCerrado(db, busetaId, anio, mes)) {
    throw new ErrorHttp(409, 'Ese mes ya está cerrado y no se puede modificar');
  }
}

// Todo lo del mes de una buseta: días, ajustes y el resumen calculado.
async function armarMes(db, buseta, anio, mes) {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const [dias, ajustes, parametros, cerrado] = await Promise.all([
    listarDias(db, buseta.id, desde, hasta),
    listarAjustes(db, buseta.id, anio, mes),
    parametrosDelMes(db, hasta),
    mesCerrado(db, buseta.id, anio, mes),
  ]);

  return {
    buseta: {
      id: buseta.id,
      numeroInterno: buseta.numeroInterno,
      placa: buseta.placa,
      tieneCupo: buseta.tieneCupo,
      valorArriendo: buseta.valorArriendo,
      conductor: buseta.conductor,
    },
    anio,
    mes,
    cerrado,
    dias,
    ajustes,
    valorRelevo: Number(parametros.valor_relevo ?? 0),
    porcentajeEmpresa: Number(parametros.porcentaje_empresa ?? 0),
    porcentajeReposicion: Number(parametros.porcentaje_reposicion ?? 0),
    resumen: calcularResumen({ dias, ajustes, parametros, buseta }),
  };
}

router.get('/', async (req, res) => {
  const { anio, mes } = validar(mesConsulta, req.query);
  const busetaId = Number(req.query.busetaId);
  const buseta = Number.isSafeInteger(busetaId) && busetaId > 0 && (await obtenerBuseta(req.app.locals.db, busetaId));
  if (!buseta) throw noEncontrado('La buseta');
  res.json(await armarMes(req.app.locals.db, buseta, anio, mes));
});

// Fecha 'YYYY-MM-DD' válida, del pasado o de hoy (hora Bogotá).
function fechaDeRuta(req) {
  const { fecha } = req.params;
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha));
  if (!valida || new Date(fecha).toISOString().slice(0, 10) !== fecha) {
    throw new ErrorHttp(400, 'Fecha inválida');
  }
  if (fecha > hoyBogota()) throw new ErrorHttp(400, 'No se pueden registrar días que todavía no han pasado');
  return { fecha, anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) };
}

// Guarda un día. Si queda todo en cero (sin relevo ni nota), se borra: así
// "vaciar" una celda en la cuadrícula equivale a quitar el registro.
router.put('/:busetaId/:fecha', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const { fecha, anio, mes } = fechaDeRuta(req);
  const datos = validar(diaEsquema, req.body);
  await verificarMesAbierto(db, buseta.id, anio, mes);

  const vacio =
    !datos.relevo &&
    !datos.observacion &&
    ['ingreso', 'peajes', 'salidas', 'acpm', 'mantenimiento'].every((c) => datos[c] === 0);

  if (vacio) {
    await borrarDia(db, buseta.id, fecha);
  } else {
    if (!buseta.conductor) {
      throw new ErrorHttp(400, 'Asigna un conductor a la buseta antes de registrar su producido');
    }
    await guardarDia(db, { busetaId: buseta.id, fecha, conductorId: buseta.conductor.id, creadoPor: req.usuario.id }, datos);
  }

  res.json(await armarMes(db, buseta, anio, mes));
});

router.delete('/:busetaId/:fecha', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const { fecha, anio, mes } = fechaDeRuta(req);
  await verificarMesAbierto(db, buseta.id, anio, mes);
  await borrarDia(db, buseta.id, fecha);
  res.json(await armarMes(db, buseta, anio, mes));
});

// ---- Ajustes del mes: bono y préstamos ----------------------------------------
router.post('/:busetaId/ajustes', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const datos = validar(ajusteEsquema, req.body);
  await verificarMesAbierto(db, buseta.id, datos.anio, datos.mes);
  await crearAjuste(db, { ...datos, busetaId: buseta.id, creadoPor: req.usuario.id });
  res.status(201).json(await armarMes(db, buseta, datos.anio, datos.mes));
});

router.delete('/:busetaId/ajustes/:id', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const ajuste = await obtenerAjuste(db, idDeRuta(req));
  if (!ajuste || ajuste.busetaId !== buseta.id) throw noEncontrado('El ajuste');
  await verificarMesAbierto(db, buseta.id, ajuste.anio, ajuste.mes);
  await borrarAjuste(db, ajuste.id);
  res.json(await armarMes(db, buseta, ajuste.anio, ajuste.mes));
});

export default router;

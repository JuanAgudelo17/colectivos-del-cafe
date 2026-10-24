import { Router } from 'express';
import { ErrorHttp, noEncontrado } from '../../compartido/http/errores.js';
import { idDeRuta, validar } from '../../compartido/http/validacion.js';
import { hoyBogota } from '../../compartido/fecha.js';
import { alcance, autenticar, requiereRol } from '../../compartido/seguridad/middleware.js';
import { obtenerBuseta } from '../busetas/index.js';
import { calcularResumen } from './calculo.js';
import { cierreDeLiquidacion, netoDeLiquidacion, resumenDeCierre } from './liquidacion.js';
import { ajusteEsquema, diaEsquema, liquidacionEsquema, mesConsulta, rutaEsquema } from './esquemas.js';
import {
  actualizarRuta,
  borrarAjuste,
  borrarCierreLiquidacion,
  borrarDia,
  crearAjuste,
  guardarCierreLiquidacion,
  guardarDia,
  listarAjustes,
  listarDias,
  listarRutas,
  mesCerrado,
  obtenerAjuste,
  obtenerCierre,
  parametrosDelMes,
  rangoDelMes,
} from './repositorio.js';

const router = Router();

// ---- Conductor: solo consulta lo suyo -----------------------------------------
// Sus días (producido, peajes, salidas, ACPM propio y de La Guaca), los totales y
// el resumen del mes de su buseta (en qué se gastó: 20 %, fondo, arriendo,
// mantenimiento, préstamos, neto…). Todo de solo lectura.
router.get('/mio', autenticar, requiereRol('conductor'), async (req, res) => {
  const db = req.app.locals.db;
  const { anio, mes } = validar(mesConsulta, req.query);
  const { busetaId, conductorId } = alcance(req.usuario);
  const buseta = busetaId && (await obtenerBuseta(db, busetaId));
  if (!buseta) return res.json({ buseta: null, anio, mes, dias: [], totales: null });

  const completo = await armarMes(db, buseta, anio, mes);
  const { desde, hasta } = rangoDelMes(anio, mes);
  const dias = (await listarDias(db, busetaId, desde, hasta, conductorId)).map(
    ({ fecha, ingreso, peajes, salidas, acpm, acpmCredito, relevo }) => ({
      fecha,
      ingreso,
      peajes,
      salidas,
      acpm,
      acpmCredito,
      relevo,
    }),
  );
  const sumar = (campo) => dias.reduce((t, d) => t + d[campo], 0);

  res.json({
    buseta: { numeroInterno: buseta.numeroInterno, placa: buseta.placa, tieneCupo: buseta.tieneCupo },
    anio,
    mes,
    cerrado: completo.cerrado,
    dias,
    // Mismo resumen que ve el admin (el componente del frontend lo muestra sin botones).
    resumen: completo.resumen,
    ajustes: completo.ajustes.map(({ id, tipo, descripcion, valor }) => ({ id, tipo, descripcion, valor })),
    porcentajeEmpresa: completo.porcentajeEmpresa,
    porcentajeReposicion: completo.porcentajeReposicion,
    valorRelevo: completo.valorRelevo,
    // Si el mes se cerró con la liquidación de la cooperativa, el documento.
    liquidacion: completo.liquidacion,
    totales: {
      ingreso: sumar('ingreso'),
      peajes: sumar('peajes'),
      salidas: sumar('salidas'),
      acpm: sumar('acpm'),
      acpmCredito: sumar('acpmCredito'),
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

// Todo lo del mes de una buseta: días, ajustes y el resumen. Si el mes se cerró
// con la liquidación de la cooperativa, el resumen sale de ella (y se devuelve
// el documento en `liquidacion`).
async function armarMes(db, buseta, anio, mes) {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const [dias, ajustes, parametros, cierre] = await Promise.all([
    listarDias(db, buseta.id, desde, hasta),
    listarAjustes(db, buseta.id, anio, mes),
    parametrosDelMes(db, hasta),
    obtenerCierre(db, buseta.id, anio, mes),
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
    cerrado: Boolean(cierre),
    dias,
    ajustes,
    valorRelevo: Number(parametros.valor_relevo ?? 0),
    porcentajeEmpresa: Number(parametros.porcentaje_empresa ?? 0),
    porcentajeReposicion: Number(parametros.porcentaje_reposicion ?? 0),
    fondoFijoArriendo: Number(parametros.fondo_fijo_arriendo ?? 0),
    resumen: cierre ? resumenDeCierre(cierre, dias) : calcularResumen({ dias, ajustes, parametros, buseta, mes }),
    liquidacion: cierre?.origen === 'liquidacion' ? cierre.liquidacion : null,
  };
}

// ---- Liquidación de la cooperativa: cierra el mes con sus valores --------------
// (van antes de /:busetaId/:fecha para que "liquidacion" no se tome como fecha).
const enPesos = (valor) => `$ ${new Intl.NumberFormat('es-CO').format(valor)}`;

router.put('/:busetaId/liquidacion', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const datos = validar(liquidacionEsquema, req.body);
  const neto = netoDeLiquidacion(datos);
  if (neto !== datos.netoAPagar) {
    throw new ErrorHttp(400, `El neto a pagar no cuadra: con estos valores da ${enPesos(neto)}`, {
      netoAPagar: `Con estos valores da ${enPesos(neto)}`,
    });
  }
  const { anio, mes, ...liquidacion } = datos;
  const existente = await obtenerCierre(db, buseta.id, anio, mes);
  if (existente && existente.origen !== 'liquidacion') throw new ErrorHttp(409, 'Ese mes ya está cerrado');

  await guardarCierreLiquidacion(db, {
    busetaId: buseta.id,
    anio,
    mes,
    cierre: cierreDeLiquidacion(datos),
    liquidacion,
    cerradoPor: req.usuario.id,
  });
  res.json(await armarMes(db, buseta, anio, mes));
});

// Quita la liquidación y el mes vuelve a quedar abierto.
router.delete('/:busetaId/liquidacion', async (req, res) => {
  const db = req.app.locals.db;
  const buseta = await busetaDeRuta(req);
  const { anio, mes } = validar(mesConsulta, req.query);
  if (!(await borrarCierreLiquidacion(db, buseta.id, anio, mes))) throw noEncontrado('La liquidación');
  res.json(await armarMes(db, buseta, anio, mes));
});

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
    ['ingreso', 'peajes', 'salidas', 'acpm', 'acpmCredito', 'mantenimiento'].every((c) => datos[c] === 0);

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

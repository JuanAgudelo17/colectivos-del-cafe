// Lee la cuenta de cobro de La Guaca (Mariscal La Guaca: el ACPM tanqueado a
// crédito) desde su PDF, en el navegador (trae la cédula del dueño: nunca sale
// del computador). Cada tanqueada es una fila de la tabla: factura, fecha
// ("02-jul-26"), producto, precio, cantidad, placa, conductor y valor (el último
// valor en pesos de la fila). Una cuenta puede traer varias placas y hojas.

import { textosDelPdf } from './textosPdf.js';

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const MISMA_LINEA = 4; // diferencia de altura (en puntos) para estar en la misma fila

const FECHA_CORTA = /^(\d{1,2})[-/ ]([A-Za-z]{3,4})\.?[-/ ](\d{2}|\d{4})$/; // 02-jul-26
const FECHA_NUMERICA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // 02/07/2026
const PLACA = /^[A-Z]{3}-?\d{3}[A-Z]?$/;
const PESOS = /^\$\s*[\d.]+$/;

const aPesos = (texto) => Number(texto.replace(/[^\d]/g, ''));
export const sinGuion = (placa) => placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();

function aFecha(texto) {
  let d;
  let m;
  let a;
  const corta = texto.match(FECHA_CORTA);
  if (corta) {
    d = Number(corta[1]);
    m = MESES[corta[2].toLowerCase().slice(0, 3)];
    a = Number(corta[3].length === 2 ? `20${corta[3]}` : corta[3]);
  } else {
    const numerica = texto.match(FECHA_NUMERICA);
    if (!numerica) return null;
    [d, m, a] = numerica.slice(1).map(Number);
  }
  if (!m || d < 1 || d > 31 || m > 12) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Junta los textos en filas (misma hoja y misma altura), cada una de izquierda a derecha.
function filasDe(items) {
  const filas = [];
  for (const it of [...items].sort((a, b) => a.pagina - b.pagina || b.y - a.y)) {
    const fila = filas.find((f) => f.pagina === it.pagina && Math.abs(f.y - it.y) <= MISMA_LINEA);
    if (fila) fila.items.push(it);
    else filas.push({ pagina: it.pagina, y: it.y, items: [it] });
  }
  return filas.map((f) => f.items.sort((a, b) => a.x - b.x));
}

/**
 * Función pura: de los textos del PDF con su posición a las tanqueadas.
 * @param {Array<{texto: string, x: number, y: number, pagina?: number}>} itemsPdf
 * @returns {{ tanqueadas: Array<{factura, fecha, placa, valor}>, valorAPagar: number|null }}
 */
export function interpretarCuentaGuaca(itemsPdf) {
  const items = itemsPdf
    .map((it) => ({ pagina: 1, ...it, texto: it.texto.trim() }))
    .filter((it) => it.texto);
  const tanqueadas = [];
  let valorAPagar = null;

  for (const fila of filasDe(items)) {
    const textos = fila.map((it) => it.texto);
    const pesos = textos.filter((t) => PESOS.test(t));
    if (textos.some((t) => /VALOR A PAGAR/i.test(t))) {
      if (pesos.length) valorAPagar = aPesos(pesos.at(-1));
      continue;
    }
    const fecha = textos.map(aFecha).find(Boolean);
    const placa = textos.find((t) => PLACA.test(t));
    if (!fecha || !placa || pesos.length === 0) continue;
    tanqueadas.push({
      factura: textos.find((t) => /^[A-Z]+-?\d+$/.test(t) && !PLACA.test(t)) ?? null,
      fecha,
      placa: sinGuion(placa),
      valor: aPesos(pesos.at(-1)),
    });
  }
  return { tanqueadas, valorAPagar };
}

/**
 * Lo de una buseta y un mes: suma las tanqueadas de esa placa en ese mes y avisa
 * lo que se dejó por fuera (otras placas, otros meses) o si no cuadra el total.
 */
export function combustibleDelMes({ tanqueadas, valorAPagar }, { placa, anio, mes }) {
  const delMes = `${anio}-${String(mes).padStart(2, '0')}`;
  const deLaPlaca = tanqueadas.filter((t) => t.placa === sinGuion(placa));
  const usadas = deLaPlaca.filter((t) => t.fecha.startsWith(delMes));
  const sumaTodas = tanqueadas.reduce((s, t) => s + t.valor, 0);
  const otrasPlacas = [...new Set(tanqueadas.filter((t) => t.placa !== sinGuion(placa)).map((t) => t.placa))];
  const otrosMeses = [...new Set(deLaPlaca.filter((t) => !t.fecha.startsWith(delMes)).map((t) => t.fecha.slice(0, 7)))];
  return {
    total: usadas.reduce((s, t) => s + t.valor, 0),
    tanqueadas: usadas.length,
    otrasPlacas,
    otrosMeses,
    // La suma de las filas tiene que dar el "valor a pagar" de la cuenta (si se leyó).
    cuadra: valorAPagar === null || valorAPagar === sumaTodas,
    sumaTodas,
    valorAPagar,
  };
}

// Lee todas las hojas del PDF y las interpreta.
export async function leerCuentaGuacaPdf(archivo) {
  return interpretarCuentaGuaca(await textosDelPdf(archivo, { todas: true }));
}

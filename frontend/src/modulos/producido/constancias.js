import { jsPDF } from 'jspdf';
import { diasDelMes, numero } from '../../compartido/utilidades/formato.js';

// Constancias de verificación del producido ("los papelitos" que van pegados a
// las planillas): una por cada día del mes, 12 por hoja carta (3 × 4) para
// imprimir y recortar. Fecha, nombre, placa y micro van siempre; peajes,
// salidas, ACPM y producido solo si ese día ya está registrado (si no, quedan en
// blanco para llenarlos a mano). La última hoja se completa con constancias sin
// fecha, de repuesto. Generado en el navegador.

const COLUMNAS = 3;
const FILAS = 4;
const MARGEN_X = 8;
const MARGEN_Y = 12;
const SEPARACION_X = 4;
const SEPARACION_Y = 7;
const ALTO_TITULO = 10;
const ALTO_FILA = 5.6;
const DIVISION = 0.45; // dónde va la línea entre la etiqueta y el valor

const CAMPOS = ['FECHA', 'NOMBRE', 'PLACA', 'MICRO', 'PEAJES', 'SALIDAS', 'ACPM', 'PRODUCIDO'];

const valor = (v) => (Number(v) > 0 ? numero(v) : '');

// Texto centrado en una celda; si no cabe, se achica la letra.
function centrado(doc, texto, x, y, ancho, tamano) {
  let t = tamano;
  doc.setFontSize(t);
  while (t > 5 && doc.getTextWidth(texto) > ancho - 2) doc.setFontSize((t -= 0.5));
  doc.text(texto, x + ancho / 2, y, { align: 'center', baseline: 'middle' });
}

function constancia(doc, x, y, ancho, datos) {
  const alto = ALTO_TITULO + ALTO_FILA * CAMPOS.length;
  const division = x + ancho * DIVISION;
  doc.setDrawColor(0).setLineWidth(0.3);
  doc.rect(x, y, ancho, alto);

  doc.setFont('times', 'bold');
  centrado(doc, 'CONSTANCIA VERIFICACIÓN', x, y + 3.2, ancho, 9);
  centrado(doc, 'PRODUCIDO DE VEHÍCULO', x, y + 7.4, ancho, 9);

  CAMPOS.forEach((campo, i) => {
    const arriba = y + ALTO_TITULO + i * ALTO_FILA;
    doc.line(x, arriba, x + ancho, arriba);
    const medio = arriba + ALTO_FILA / 2;
    doc.setFont('times', 'bold');
    centrado(doc, campo, x, medio, division - x, 8.5);
    if (datos[campo]) centrado(doc, datos[campo], division, medio, x + ancho - division, 8.5);
  });
  doc.line(division, y + ALTO_TITULO, division, y + alto);
}

const POR_HOJA = COLUMNAS * FILAS;

// Las constancias de una buseta en un mes, completando la última hoja con repuestos.
function constanciasDe(mes) {
  const fijos = {
    NOMBRE: mes.buseta.conductor?.nombre ?? '',
    PLACA: mes.buseta.placa,
    MICRO: mes.buseta.numeroInterno,
  };
  const porFecha = Object.fromEntries(mes.dias.map((d) => [d.fecha, d]));
  const constancias = diasDelMes(mes.anio, mes.mes).map(({ fecha }) => {
    const d = porFecha[fecha];
    const [a, m, dia] = fecha.split('-');
    return {
      ...fijos,
      FECHA: `${dia} / ${m} / ${a}`,
      PEAJES: valor(d?.peajes),
      SALIDAS: valor(d?.salidas),
      // El ACPM del día: lo que pagó el conductor más lo tanqueado a crédito en La Guaca.
      ACPM: valor((d?.acpm ?? 0) + (d?.acpmCredito ?? 0)),
      PRODUCIDO: valor(d?.ingreso),
    };
  });
  // Repuestos sin fecha hasta completar la última hoja.
  while (constancias.length % POR_HOJA !== 0) constancias.push({ ...fijos });
  return constancias;
}

/**
 * @param {object[]} meses  el mes de /producido (admin) de cada buseta: buseta (con conductor) y días.
 *   Cada buseta empieza en hoja nueva.
 */
export function exportarConstancias(meses) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const anchoHoja = doc.internal.pageSize.getWidth();
  const ancho = (anchoHoja - MARGEN_X * 2 - SEPARACION_X * (COLUMNAS - 1)) / COLUMNAS;
  const alto = ALTO_TITULO + ALTO_FILA * CAMPOS.length;

  meses.flatMap(constanciasDe).forEach((datos, i) => {
    const enHoja = i % POR_HOJA;
    if (i > 0 && enHoja === 0) doc.addPage();
    const columna = enHoja % COLUMNAS;
    const fila = Math.floor(enHoja / COLUMNAS);
    constancia(
      doc,
      MARGEN_X + columna * (ancho + SEPARACION_X),
      MARGEN_Y + fila * (alto + SEPARACION_Y),
      ancho,
      datos,
    );
  });

  const { anio, mes } = meses[0];
  const quien = meses.length === 1 ? meses[0].buseta.numeroInterno : 'flota';
  doc.save(`constancias-${quien}-${anio}-${String(mes).padStart(2, '0')}.pdf`);
}

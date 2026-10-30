import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fecha, nombreMes, numero } from '../../compartido/utilidades/formato.js';
import { NOMINA, OPERATIVOS } from './liquidacion.js';

// PDF del mes de una buseta, generado en el navegador (nada sale del celular):
// encabezado, cifras principales, el resumen como en la planilla (o la
// liquidación de la cooperativa, si el mes se cerró con ella), la conciliación
// (solo admin) y los días. Sirve igual para el admin (`mes` de /producido) y
// para el conductor (`mes` de /producido/mio).
//
// Las fuentes del PDF (Helvetica) no traen "−" ni "✓": se usa "-" y texto.

const NEGRO = [0, 0, 0];
const BLANCO = [255, 255, 255];
const PIZARRA = [94, 94, 94];
const LINEA = [226, 226, 226];
const NIEBLA = [246, 246, 246];
const MARGEN = 16;

const plano = (texto) => String(texto).replace(/\s/g, ' ');
const enPesos = (valor) => `$ ${numero(valor)}`;
const menos = (valor) => `- ${numero(valor)}`;
const conSigno = (valor) => (valor === 0 ? 'Igual' : `${valor > 0 ? '+' : '-'} ${numero(Math.abs(valor))}`);
const porciento = (v) => `${Math.round(v * 10000) / 100} %`;
const mayuscula = (t) => t.replace(/^./, (l) => l.toUpperCase());
const semana = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' });
const diaCorto = (iso) => `${semana.format(new Date(`${iso}T12:00:00Z`)).replace('.', '')} ${iso.slice(8)}`;

// Líneas del resumen como en la planilla (igual que ResumenMes).
function lineasResumen(mes) {
  const r = mes.resumen;
  const ajustes = (tipo, titulo) =>
    mes.ajustes.filter((a) => a.tipo === tipo).map((a) => [`${titulo}${a.descripcion ? ` · ${a.descripcion}` : ''}`, a.valor]);
  return {
    descuentos: [
      [`Empresa (${porciento(mes.porcentajeEmpresa)})`, r.empresa],
      [r.fondoFijo ? 'Fondo de reposición (fijo, paga arriendo)' : `Fondo de reposición (${porciento(mes.porcentajeReposicion)})`, r.reposicion],
      ['Conductor', r.conductor],
      ['Peajes', r.peajes],
      ['Salidas', r.salidas],
      r.mantenimiento > 0 && ['Mantenimiento', r.mantenimiento],
      r.arriendo > 0 && ['Arriendo', r.arriendo],
      r.relevo > 0 && [`Relevo (${r.diasRelevo} × ${numero(mes.valorRelevo)})`, r.relevo],
      r.seguroContractual > 0 && ['Seguro contractual', r.seguroContractual],
      ...ajustes('prestamo', 'Préstamo'),
      ...ajustes('bono', 'Bono'),
    ].filter(Boolean),
    acpm: [['ACPM conductor', r.acpmConductor], r.acpmCredito > 0 && ['ACPM La Guaca (crédito)', r.acpmCredito]].filter(Boolean),
  };
}

// En las tablas de números, el título y el total también van a la derecha
// (columnStyles solo alinea el cuerpo).
const numerosALaDerecha = ({ cell, column, section }) => {
  if (column.index > 0 && section !== 'body') cell.styles.halign = 'right';
};

// Título de sección con una raya negra debajo.
function titulo(doc, texto, y) {
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NEGRO);
  doc.text(texto, MARGEN, y);
  doc.setDrawColor(...NEGRO).setLineWidth(0.4);
  doc.line(MARGEN, y + 2, doc.internal.pageSize.getWidth() - MARGEN, y + 2);
  return y + 6;
}

// Si no cabe lo que sigue, a la página siguiente.
function espacio(doc, y, alto) {
  if (y + alto <= doc.internal.pageSize.getHeight() - 20) return y;
  doc.addPage();
  return 20;
}

// Tabla de concepto → valor, con filas de total en negro.
function tablaResumen(doc, y, filas) {
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, textColor: NEGRO },
    columnStyles: { 1: { halign: 'right', cellWidth: 45 } },
    body: filas.map(([concepto, valor, total]) =>
      total
        ? [
            { content: concepto, styles: { fillColor: NEGRO, textColor: BLANCO, fontStyle: 'bold', fontSize: 11 } },
            { content: valor, styles: { fillColor: NEGRO, textColor: BLANCO, fontStyle: 'bold', fontSize: 11, halign: 'right' } },
          ]
        : [concepto, valor],
    ),
    didDrawCell: ({ doc: d, cell, row, section }) => {
      if (section !== 'body' || filas[row.index][2]) return;
      d.setDrawColor(...LINEA).setLineWidth(0.2);
      d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
    },
  });
  return doc.lastAutoTable.finalY + 8;
}

/**
 * @param {object} mes  el mes de /producido (admin) o de /producido/mio (conductor)
 * @param {{ conductor?: string }} [opciones]  nombre del conductor (el admin lo tiene en mes.buseta)
 */
export function exportarMesPdf(mes, { conductor } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const r = mes.resumen;
  const periodo = mayuscula(nombreMes(mes.anio, mes.mes));
  const nombreConductor = conductor ?? mes.buseta.conductor?.nombre;

  // ---- Encabezado negro
  doc.setFillColor(...NEGRO).rect(0, 0, ancho, 30, 'F');
  doc.setTextColor(...BLANCO).setFont('helvetica', 'bold').setFontSize(18);
  doc.text('El Producido', MARGEN, 14);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text('Colectivos del Café · Registro contable de busetas', MARGEN, 21);
  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text('Resumen del mes', ancho - MARGEN, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(periodo, ancho - MARGEN, 21, { align: 'right' });

  // ---- Buseta, conductor y estado
  let y = 42;
  doc.setTextColor(...NEGRO).setFont('helvetica', 'bold').setFontSize(15);
  doc.text(`Buseta ${mes.buseta.numeroInterno} · ${mes.buseta.placa}`, MARGEN, y);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...PIZARRA);
  const estado = mes.liquidacion
    ? `Cerrado con la liquidación de la cooperativa${mes.liquidacion.fecha ? ` del ${fecha(mes.liquidacion.fecha)}` : ''}`
    : mes.cerrado
      ? 'Mes cerrado'
      : 'Mes abierto: valores preliminares, pueden cambiar';
  const detalle = [
    nombreConductor && `Conductor: ${nombreConductor}`,
    mes.buseta.tieneCupo === false ? 'Sin cupo (paga arriendo)' : mes.buseta.tieneCupo && 'Con cupo',
  ].filter(Boolean);
  doc.text(detalle.join('   ·   '), MARGEN, y + 6);
  doc.setFont('helvetica', 'bold').setTextColor(...NEGRO);
  doc.text(estado, MARGEN, y + 11.5);

  // ---- Cifras principales
  y += 19;
  const neto = mes.liquidacion ? mes.liquidacion.netoAPagar : r.neto;
  const cifras = [
    ['Producido del mes', enPesos(r.bruto)],
    ['Días trabajados', mes.liquidacion && r.diasTrabajados === 0 ? '-' : String(r.diasTrabajados)],
    [mes.liquidacion ? 'Neto a pagar' : 'Total neto', enPesos(neto)],
  ];
  const anchoCifra = (ancho - MARGEN * 2 - 8) / 3;
  cifras.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + i * (anchoCifra + 4);
    const destacada = i === 2;
    doc.setDrawColor(...NEGRO).setLineWidth(0.3);
    if (destacada) doc.setFillColor(...NEGRO).roundedRect(x, y, anchoCifra, 20, 2, 2, 'F');
    else doc.roundedRect(x, y, anchoCifra, 20, 2, 2, 'S');
    doc.setTextColor(...(destacada ? BLANCO : PIZARRA)).setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text(etiqueta.toUpperCase(), x + 4, y + 7);
    doc.setTextColor(...(destacada ? BLANCO : NEGRO)).setFont('helvetica', 'bold').setFontSize(14);
    doc.text(plano(valor), x + 4, y + 15.5);
  });
  y += 30;

  // ---- Resumen (o la liquidación de la cooperativa)
  if (mes.liquidacion) {
    const l = mes.liquidacion;
    y = titulo(doc, 'Liquidación de la cooperativa', y);
    const lineas = (grupo) => grupo.filter(([clave]) => l[clave] > 0).map(([clave, nombre]) => [nombre, menos(l[clave])]);
    y = tablaResumen(doc, y, [
      ['Total bruto', enPesos(l.totalBruto), true],
      ...lineas(OPERATIVOS),
      ...lineas(NOMINA),
      ['Neto a pagar', enPesos(l.netoAPagar), true],
    ]);
  } else {
    const { descuentos, acpm } = lineasResumen(mes);
    y = titulo(doc, 'En qué se fue la plata', y);
    y = tablaResumen(doc, y, [
      ['Producido del mes', enPesos(r.bruto)],
      ...descuentos.map(([c, v]) => [c, menos(v)]),
      ['Total bruto', enPesos(r.netoAntesAcpm), true],
      ...acpm.map(([c, v]) => [c, menos(v)]),
      ['Total neto', enPesos(r.neto), true],
      ...(r.acpmCredito > 0 ? [['Por pagar a La Guaca', enPesos(r.acpmCredito)]] : []),
    ]);
  }

  // ---- Conciliación (solo la trae el admin)
  if (mes.conciliacion) {
    const c = mes.conciliacion;
    y = titulo(doc, 'Planilla vs. cooperativa', espacio(doc, y, 40));
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.8, textColor: NEGRO },
      headStyles: { fontStyle: 'bold', textColor: PIZARRA, lineWidth: { bottom: 0.4 }, lineColor: NEGRO },
      footStyles: { fontStyle: 'bold', fillColor: NIEBLA },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: numerosALaDerecha,
      head: [['Concepto', 'Planilla', 'Cooperativa', 'Diferencia']],
      body: c.lineas.map((l) => [l.nota ? `${l.nombre} (${l.nota.toLowerCase()})` : l.nombre, numero(l.planilla), numero(l.cooperativa), conSigno(l.diferencia)]),
      foot: [['Neto', numero(c.neto.planilla), numero(c.neto.cooperativa), conSigno(c.neto.diferencia)]],
    });
    y = doc.lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...PIZARRA);
    doc.text('Diferencia = cooperativa - planilla (en un descuento, + = la cooperativa descontó más).', MARGEN, y);
    y += 10;
  }

  // ---- Días del mes
  if (mes.dias.length > 0) {
    const hay = (campo) => mes.dias.some((d) => Number(d[campo] ?? 0) > 0);
    const columnas = [
      ['ingreso', 'Producido'],
      ['peajes', 'Peajes'],
      ['salidas', 'Salidas'],
      ['acpm', 'ACPM'],
      hay('acpmCredito') && ['acpmCredito', 'La Guaca'],
      hay('mantenimiento') && ['mantenimiento', 'Mantenim.'],
    ].filter(Boolean);
    const conRelevo = mes.dias.some((d) => d.relevo);
    const total = (campo) => mes.dias.reduce((t, d) => t + Number(d[campo] ?? 0), 0);

    y = titulo(doc, `Días del mes (${r.diasTrabajados} trabajados)`, espacio(doc, y, 30));
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.6, textColor: NEGRO },
      headStyles: { fillColor: NEGRO, textColor: BLANCO, fontStyle: 'bold' },
      footStyles: { fillColor: NIEBLA, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: NIEBLA },
      columnStyles: Object.fromEntries(columnas.map((_, i) => [i + 1, { halign: 'right' }])),
      didParseCell: numerosALaDerecha,
      head: [['Día', ...columnas.map(([, nombre]) => nombre), ...(conRelevo ? ['Relevo'] : [])]],
      body: mes.dias.map((d) => [
        diaCorto(d.fecha),
        ...columnas.map(([campo]) => (Number(d[campo] ?? 0) ? numero(d[campo]) : '')),
        ...(conRelevo ? [d.relevo ? 'Sí' : ''] : []),
      ]),
      foot: [['Total', ...columnas.map(([campo]) => numero(total(campo))), ...(conRelevo ? [String(mes.dias.filter((d) => d.relevo).length)] : [])]],
    });
  }

  // ---- Pie de página en todas las hojas
  const generado = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, alto - 12, ancho - MARGEN, alto - 12);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...PIZARRA);
    doc.text(plano(`Generado el ${generado} · el-producido.netlify.app`), MARGEN, alto - 7);
    doc.text(`Página ${i} de ${paginas}`, ancho - MARGEN, alto - 7, { align: 'right' });
  }

  doc.save(`producido-${mes.buseta.numeroInterno}-${mes.anio}-${String(mes.mes).padStart(2, '0')}.pdf`);
}

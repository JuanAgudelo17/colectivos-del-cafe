// Lee la "Liquidación mensual de vehículos" de la cooperativa desde su PDF, en
// el navegador (el PDF trae cédulas: nunca sale del computador). El formato es
// siempre el mismo: cada valor está en la misma línea que su etiqueta, a la
// derecha (dos columnas: descuentos operativos y de nómina). El texto del PDF
// viene desordenado, así que se ubica por posición y no por orden.

// Etiqueta del documento (sin tildes, puntos ni espacios de más) → campo del formulario.
const ETIQUETAS = {
  'TOTAL BRUTO': 'totalBruto',
  ADMINISTRACION: 'administracion',
  POLIZAS: 'polizas',
  'FONDO REPOSICION': 'fondoReposicion',
  SALIDAS: 'salidas',
  COMBUSTIBLES: 'combustibles',
  PEAJES: 'peajes',
  PRESTAMOS: 'prestamos',
  'SALARIO CONDUCTOR': 'salarioConductor',
  'PRESTACIONES CONDUCTOR': 'prestacionesConductor',
  'SEGURIDAD SOCIAL CONDUCTOR': 'seguridadSocialConductor',
  'SALARIO RELEVO': 'salarioRelevo',
  'PRESTACIONES RELEVO': 'prestacionesRelevo',
  'SEG SOCIAL RELEVO': 'seguridadSocialRelevo',
  'SEGURIDAD SOCIAL RELEVO': 'seguridadSocialRelevo',
  'P VACACIONES RELEVO': 'vacacionesRelevo',
  'VACACIONES RELEVO': 'vacacionesRelevo',
  'NETO A PAGAR': 'netoAPagar',
};

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const MISMA_LINEA = 4; // diferencia de altura (en puntos) para estar en la misma línea

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const esNumero = (texto) => /^\$?\s*[\d.,]+$/.test(texto.trim());
const aPesos = (texto) => Number(texto.replace(/[^\d]/g, ''));

// Si el PDF juntó etiqueta y valor en un solo texto ("PRESTACIONES CONDUCTOR  391,207"), se separan.
function separar(items) {
  return items.flatMap((it) => {
    const m = it.texto.match(/^(.*[A-Za-zÁÉÍÓÚáéíóú.])\s+(\$?\s*[\d.,]+)$/);
    if (!m) return [it];
    return [
      { ...it, texto: m[1] },
      { ...it, texto: m[2], x: it.x + it.ancho * (m[1].length / it.texto.length) },
    ];
  });
}

/**
 * Función pura: de los textos del PDF con su posición a los valores del formulario.
 * @param {Array<{texto: string, x: number, y: number, ancho?: number}>} itemsPdf
 * @returns {{ valores: object, leidos: number, periodo: {anio, mes}|null, micro: string|null, placa: string|null }}
 */
export function interpretarLiquidacion(itemsPdf) {
  const items = separar(itemsPdf.filter((it) => it.texto.trim()).map((it) => ({ ancho: 0, ...it, texto: it.texto.trim() })));
  // Etiquetas: los textos con letras (los valores son números o fechas).
  const etiquetas = items.filter((it) => /[A-Za-zÁÉÍÓÚáéíóú]/.test(it.texto));
  const enLinea = (a, b) => Math.abs(a.y - b.y) <= MISMA_LINEA;
  // Lo que está a la derecha de una etiqueta en su misma línea; con `hastaOtra`,
  // solo antes de la siguiente etiqueta (la otra columna).
  const aLaDerecha = (etiqueta, { hastaOtra = true } = {}) => {
    const limite = !hastaOtra
      ? Infinity
      : Math.min(
          Infinity,
          ...etiquetas.filter((e) => e !== etiqueta && enLinea(e, etiqueta) && e.x > etiqueta.x).map((e) => e.x),
        );
    return items
      .filter((it) => it !== etiqueta && enLinea(it, etiqueta) && it.x > etiqueta.x && it.x < limite)
      .sort((a, b) => a.x - b.x);
  };

  const valores = {};
  let periodo = null;
  let micro = null;
  let placa = null;

  for (const etiqueta of etiquetas) {
    const nombre = normalizar(etiqueta.texto);
    const campo = ETIQUETAS[nombre];
    if (campo) {
      const numero = aLaDerecha(etiqueta).find((it) => esNumero(it.texto));
      if (numero) valores[campo] = aPesos(numero.texto);
      continue;
    }
    if (nombre === 'FECHA') {
      const fecha = aLaDerecha(etiqueta).find((it) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(it.texto));
      if (fecha) {
        const [d, m, a] = fecha.texto.split('/');
        valores.fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      continue;
    }
    if (nombre === 'MICROBUS' || nombre === 'MICRO') micro = aLaDerecha(etiqueta, { hastaOtra: false })[0]?.texto ?? null;
    if (nombre === 'PLACA') placa = aLaDerecha(etiqueta, { hastaOtra: false })[0]?.texto ?? null;
    // "AGOSTO 2026" (junto, o el año como texto aparte a la derecha).
    const delMes = nombre.match(/^([A-Z]+)(?: (\d{4}))?$/);
    if (delMes && MESES.includes(delMes[1])) {
      const anio = delMes[2] ?? aLaDerecha(etiqueta, { hastaOtra: false }).find((it) => /^\d{4}$/.test(it.texto))?.texto;
      if (anio) periodo = { anio: Number(anio), mes: MESES.indexOf(delMes[1]) + 1 };
    }
  }

  return {
    valores,
    leidos: Object.keys(valores).filter((c) => c !== 'fecha').length,
    periodo,
    micro,
    placa,
  };
}

// Textos de la primera hoja del PDF con su posición. pdf.js se carga solo al usarlo.
export async function leerLiquidacionPdf(archivo) {
  const [pdfjs, { default: trabajador }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador;
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  try {
    const documento = await tarea.promise;
    const { items } = await (await documento.getPage(1)).getTextContent();
    return interpretarLiquidacion(
      items.map((it) => ({ texto: it.str, x: it.transform[4], y: it.transform[5], ancho: it.width })),
    );
  } finally {
    tarea.destroy();
  }
}

// Columnas de la cuadrícula del mes: [campo en la BD, título].
export const COLUMNAS = [
  ['ingreso', 'Producido'],
  ['peajes', 'Peajes'],
  ['salidas', 'Salidas'],
  ['acpm', 'ACPM'],
  ['acpmCredito', 'ACPM Guaca'],
];

// Lee un bloque copiado de Excel (texto separado por tabulaciones) y devuelve
// los valores por día. Entiende dos formas:
//
// 1. Horizontal, como la planilla actual: una fila con los números de los días
//    (puede empezar con "dia" o vacía) y debajo filas "producido", "peajes",
//    "salidas", "acpm" (y "mantenimiento"). Puede haber varios bloques (1-10,
//    11-20, 21-31); cada fila de días cambia las columnas de las filas siguientes.
// 2. Vertical: encabezado "dia | producido | peajes | salidas | acpm" y una fila por día.
//
// Devuelve { [dia]: { ingreso, peajes, salidas, acpm, acpmCredito, mantenimiento } } con solo
// los campos que traían valor. Los números aceptan puntos, comas y "$".

const CAMPOS = {
  producido: 'ingreso',
  ingreso: 'ingreso',
  peajes: 'peajes',
  peaje: 'peajes',
  salidas: 'salidas',
  salida: 'salidas',
  acpm: 'acpm',
  combustible: 'acpm',
  'acpm conductor': 'acpm',
  guaca: 'acpmCredito',
  'acpm guaca': 'acpmCredito',
  'la guaca': 'acpmCredito',
  'acpm credito': 'acpmCredito',
  mantenimiento: 'mantenimiento',
};

const normalizar = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// "630.000" / "$ 630,000" / "630000" → 630000; vacío → null
function valor(celda) {
  const digitos = String(celda ?? '').replace(/[^\d]/g, '');
  return digitos === '' ? null : Number(digitos);
}

const esDia = (celda) => /^\d{1,2}$/.test(String(celda).trim()) && Number(celda) >= 1 && Number(celda) <= 31;

export function leerPlanilla(texto) {
  const filas = texto
    .split(/\r?\n/)
    .map((linea) => linea.split('\t'))
    .filter((celdas) => celdas.some((c) => c.trim() !== ''));

  const resultado = {};
  const anotar = (dia, campo, v) => {
    if (v === null) return;
    resultado[dia] ??= {};
    resultado[dia][campo] = v;
  };

  // ¿Vertical? Encabezado con nombres de campos en las columnas.
  const encabezado = filas[0]?.map(normalizar) ?? [];
  const columnas = encabezado.map((c) => CAMPOS[c]);
  if (columnas.filter(Boolean).length >= 2 && ['dia', 'día', 'fecha'].includes(encabezado[0])) {
    for (const celdas of filas.slice(1)) {
      if (!esDia(celdas[0])) continue;
      columnas.forEach((campo, i) => campo && anotar(Number(celdas[0]), campo, valor(celdas[i])));
    }
    return resultado;
  }

  // Horizontal, por bloques.
  let dias = null;
  for (const celdas of filas) {
    const etiqueta = normalizar(celdas[0]);
    const resto = celdas.slice(1);

    if ((etiqueta === '' || etiqueta === 'dia') && resto.some(esDia)) {
      dias = resto.map((c) => (esDia(c) ? Number(c) : null));
      continue;
    }
    const campo = CAMPOS[etiqueta];
    if (!campo || !dias) continue;
    resto.forEach((celda, i) => dias[i] && anotar(dias[i], campo, valor(celda)));
  }
  return resultado;
}

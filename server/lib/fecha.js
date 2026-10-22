export const ZONA_HORARIA = 'America/Bogota';

// Fecha y hora actual en Bogotá con formato 'YYYY-MM-DD HH:mm:ss'.
export function ahoraBogota(fecha = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(fecha);
}

// Año y mes (1-12) actuales en Bogotá. Define el "mes actual" del ciclo contable.
export function mesActualBogota(fecha = new Date()) {
  const [anio, mes] = ahoraBogota(fecha).slice(0, 7).split('-').map(Number);
  return { anio, mes };
}

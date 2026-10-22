export const ZONA_HORARIA = 'America/Bogota';

// Fecha y hora actual en Bogotá con formato 'YYYY-MM-DD HH:mm:ss'.
export function ahoraBogota(fecha = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(fecha);
}

// Fecha de hoy en Bogotá, 'YYYY-MM-DD'.
export function hoyBogota(fecha = new Date()) {
  return ahoraBogota(fecha).slice(0, 10);
}

// Año y mes (1-12) actuales en Bogotá. Define el "mes actual" del ciclo contable.
export function mesActualBogota(fecha = new Date()) {
  const [anio, mes] = hoyBogota(fecha).slice(0, 7).split('-').map(Number);
  return { anio, mes };
}

// Días de calendario entre dos fechas 'YYYY-MM-DD' (positivo si `hasta` es después).
export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

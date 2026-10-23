const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// 1200000 → "$ 1.200.000"
export function pesos(valor) {
  return valor == null ? '—' : formatoPesos.format(valor);
}

// 'YYYY-MM-DD' → 'DD/MM/AAAA'. Se hace con texto para no correr la fecha por zona horaria.
export function fecha(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// "jueves, 22 de octubre de 2026" en hora de Bogotá.
export function fechaLargaHoy() {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full' }).format(new Date());
}

// 1200000 → "1.200.000" (sin signo de pesos, para tablas y celdas).
const formatoNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export function numero(valor) {
  return valor == null || valor === '' ? '' : formatoNumero.format(valor);
}

// 121500 → "121.500 km"
export function kilometros(valor) {
  return valor == null ? '—' : `${formatoNumero.format(valor)} km`;
}

// Hoy en Bogotá como 'YYYY-MM-DD'.
export function hoyBogota() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
}

// Mes actual en Bogotá: { anio, mes } (mes 1-12).
export function mesActual() {
  const [anio, mes] = hoyBogota().split('-').map(Number);
  return { anio, mes };
}

// (2026, 10) → "octubre de 2026"
export function nombreMes(anio, mes) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  );
}

// Días del mes como 'YYYY-MM-DD', con el nombre corto del día ("lun").
export function diasDelMes(anio, mes) {
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const semana = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: total }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1, i + 1));
    return { dia: i + 1, fecha: fecha.toISOString().slice(0, 10), semana: semana.format(fecha).replace('.', '') };
  });
}

// Texto de un documento según el estado que calcula el backend.
export function textoDocumento({ estado, dias, fecha: vence }) {
  if (estado === 'sin_fecha') return 'Sin fecha registrada';
  if (estado === 'vencido') return dias === -1 ? 'Venció ayer' : `Vencido hace ${-dias} días`;
  if (dias === 0) return 'Vence hoy';
  if (estado === 'por_vencer') return dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
  return `Vigente hasta ${fecha(vence)}`;
}

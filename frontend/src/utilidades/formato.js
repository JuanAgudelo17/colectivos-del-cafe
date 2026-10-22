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

// Texto de un documento según el estado que calcula el backend.
export function textoDocumento({ estado, dias, fecha: vence }) {
  if (estado === 'sin_fecha') return 'Sin fecha registrada';
  if (estado === 'vencido') return dias === -1 ? 'Venció ayer' : `Vencido hace ${-dias} días`;
  if (dias === 0) return 'Vence hoy';
  if (estado === 'por_vencer') return dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
  return `Vigente hasta ${fecha(vence)}`;
}

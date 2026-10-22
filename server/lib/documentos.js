import { diasEntre, hoyBogota } from './fecha.js';

export const DIAS_ALERTA = 30;

// Estado de un documento (SOAT o tecnomecánica) según su fecha de vencimiento:
//   sin_fecha | vencido | por_vencer (≤ 30 días) | vigente
// `dias` = días que faltan (negativo si ya venció).
export function estadoDocumento(fechaVencimiento, hoy = hoyBogota()) {
  if (!fechaVencimiento) return { fecha: null, estado: 'sin_fecha', dias: null };

  const dias = diasEntre(hoy, fechaVencimiento);
  let estado = 'vigente';
  if (dias < 0) estado = 'vencido';
  else if (dias <= DIAS_ALERTA) estado = 'por_vencer';

  return { fecha: fechaVencimiento, estado, dias };
}

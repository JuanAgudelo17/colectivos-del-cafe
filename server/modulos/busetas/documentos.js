import { diasEntre, hoyBogota } from '../../compartido/fecha.js';

export const DIAS_ALERTA = 30;

// Documentos con vencimiento de cada buseta: clave en la API → campo de la fecha.
// Todos con la misma alerta; solo el admin los edita.
export const DOCUMENTOS = {
  soat: 'fechaSoat',
  tecnomecanica: 'fechaTecnomecanica',
  tarjetaOperacion: 'fechaTarjetaOperacion',
  polizaRcc: 'fechaPolizaRcc',
  polizaRce: 'fechaPolizaRce',
  extintor: 'fechaExtintor',
};

// Estado de un documento según su fecha de vencimiento:
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

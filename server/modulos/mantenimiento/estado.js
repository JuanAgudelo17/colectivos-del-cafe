import { diasEntre, hoyBogota } from '../../compartido/fecha.js';

// "Pronto" cuando faltan 500 km o menos, o 15 días o menos (lo que llegue primero).
export const KM_ALERTA = 500;
export const DIAS_ALERTA = 15;

// El conductor puede corregir o borrar lo que registró durante 7 días; el admin, siempre.
export const DIAS_EDICION = 7;

// Estado de un tipo de mantenimiento según su último registro:
//   sin_registro | al_dia | pronto | vencido
// Vence por kilometraje o por fecha, lo que ocurra primero.
// `kmRestantes` / `dias`: lo que falta (negativo si ya se pasó; null si no aplica).
export function estadoMantenimiento(ultimo, kmActual, hoy = hoyBogota()) {
  if (!ultimo) return { estado: 'sin_registro', kmRestantes: null, dias: null };

  const kmRestantes = ultimo.proximoKm != null && kmActual != null ? ultimo.proximoKm - kmActual : null;
  const dias = ultimo.proximaFecha ? diasEntre(hoy, ultimo.proximaFecha) : null;

  let estado = 'al_dia';
  if ((kmRestantes !== null && kmRestantes < 0) || (dias !== null && dias < 0)) estado = 'vencido';
  else if ((kmRestantes !== null && kmRestantes <= KM_ALERTA) || (dias !== null && dias <= DIAS_ALERTA)) {
    estado = 'pronto';
  }

  return { estado, kmRestantes, dias };
}

// Una tarjeta por cada tipo activo que tiene intervalo (los que no, como "Otro",
// solo aparecen en el historial).
export function armarEstados(tipos, ultimos, kmActual, hoy = hoyBogota()) {
  const ultimoDe = new Map(ultimos.map((u) => [u.tipo, u]));
  return tipos
    .filter((t) => t.activo && (t.intervaloKm || t.intervaloMeses))
    .map((t) => {
      const ultimo = ultimoDe.get(t.clave) ?? null;
      return {
        tipo: t.clave,
        nombre: t.nombre,
        ultimo: ultimo && {
          id: ultimo.id,
          fecha: ultimo.fecha,
          kilometraje: ultimo.kilometraje,
          proximoKm: ultimo.proximoKm,
          proximaFecha: ultimo.proximaFecha,
        },
        ...estadoMantenimiento(ultimo, kmActual, hoy),
      };
    });
}

export function puedeEditar(usuario, registro, ahora = new Date()) {
  if (usuario.rol === 'admin') return true;
  const edad = ahora - new Date(registro.creadoEn);
  return registro.registradoPor.id === usuario.id && edad <= DIAS_EDICION * 86_400_000;
}

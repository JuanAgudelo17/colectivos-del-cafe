// Propone peajes y salidas a partir de las vueltas del día por ruta:
//   peajes  = vueltas × 2 × peaje del trayecto
//   salidas = vueltas × (salida de ida + salida de regreso)
// El admin puede corregir después en la cuadrícula (días con trayectos sueltos).
export function calcularVueltas(rutas, vueltas) {
  return rutas.reduce(
    (total, r) => {
      const n = Number(vueltas[r.id] || 0);
      return {
        peajes: total.peajes + n * 2 * r.peajeTrayecto,
        salidas: total.salidas + n * (r.salidaIda + r.salidaRegreso),
      };
    },
    { peajes: 0, salidas: 0 },
  );
}

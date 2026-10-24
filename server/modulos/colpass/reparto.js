// Reparte lo entregado sobre los peajes del Colpass, en orden: cada entrega
// cubre primero los días pendientes más viejos. Si no alcanza para un día
// completo, ese día queda "parcial" y lo que falta sigue pendiente.
// Función pura (sin base de datos).
//
// dias:     [{ fecha, peajes }] desde el inicio del Colpass, en orden, con peajes > 0
// entregas: [{ id, fecha, valor, ... }] en el orden en que se registraron (fecha, id)
export function repartir(dias, entregas) {
  const totalPeajes = dias.reduce((t, d) => t + d.peajes, 0);
  const totalEntregado = entregas.reduce((t, e) => t + e.valor, 0);

  // Cuánto de cada día ya está cubierto por el total entregado.
  let restante = totalEntregado;
  const conEstado = dias.map((d) => {
    const cubierto = Math.min(d.peajes, restante);
    restante -= cubierto;
    const estado = cubierto === d.peajes ? 'liquidado' : cubierto > 0 ? 'parcial' : 'pendiente';
    return { ...d, cubierto, estado };
  });

  // Qué días cubre cada entrega (para mostrar "cubre del ... al ...").
  let dia = 0;
  let usadoDelDia = 0;
  const entregasConDias = entregas.map((e) => {
    let monto = e.valor;
    let desde = null;
    let hasta = null;
    while (monto > 0 && dia < dias.length) {
      const usa = Math.min(monto, dias[dia].peajes - usadoDelDia);
      desde ??= dias[dia].fecha;
      hasta = dias[dia].fecha;
      monto -= usa;
      usadoDelDia += usa;
      if (usadoDelDia === dias[dia].peajes) {
        dia += 1;
        usadoDelDia = 0;
      }
    }
    return { ...e, cubre: desde && { desde, hasta } };
  });

  const sinCubrir = conEstado.filter((d) => d.estado !== 'liquidado');
  return {
    dias: conEstado,
    entregas: entregasConDias,
    pendiente: {
      total: Math.max(totalPeajes - totalEntregado, 0),
      dias: sinCubrir.length,
      desde: sinCubrir[0]?.fecha ?? null,
      hasta: sinCubrir.at(-1)?.fecha ?? null,
    },
    // Si se corrigen peajes en el producido después de entregar, puede sobrar.
    saldoAFavor: Math.max(totalEntregado - totalPeajes, 0),
    totalEntregado,
  };
}

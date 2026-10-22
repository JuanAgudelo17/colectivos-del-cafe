// Filtro estándar por estado activo/inactivo para busetas y conductores.
export const FILTROS_ACTIVO = {
  activos: (x) => x.activo,
  inactivos: (x) => !x.activo,
  todos: () => true,
};

export function opcionesActivo(lista, { activos = 'Activos', inactivos = 'Inactivos' } = {}) {
  return [
    { valor: 'activos', texto: activos, cantidad: lista?.filter(FILTROS_ACTIVO.activos).length },
    { valor: 'inactivos', texto: inactivos, cantidad: lista?.filter(FILTROS_ACTIVO.inactivos).length },
    { valor: 'todos', texto: 'Todos', cantidad: lista?.length },
  ];
}

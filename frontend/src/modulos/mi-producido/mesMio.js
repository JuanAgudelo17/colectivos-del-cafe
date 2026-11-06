// Consulta de Mi producido de un mes y si ese mes trae algo (días o la
// liquidación de la cooperativa). La usan el inicio y la página: la ruta tiene
// que ser idéntica en las dos (lo guardado sin señal se busca por dirección).
export const rutaMio = ({ anio, mes }) => `/producido/mio?anio=${anio}&mes=${mes}`;

export const tieneDatos = (datos) => !datos.buseta || datos.dias.length > 0 || Boolean(datos.liquidacion);

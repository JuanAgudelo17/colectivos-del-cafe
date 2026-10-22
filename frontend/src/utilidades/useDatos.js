import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// Carga GET /api{ruta} y la vuelve a cargar cuando cambia la ruta o se llama recargar().
// ruta null = no cargar nada (útil cuando falta un dato para armarla).
export function useDatos(ruta) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null });
  const clave = ruta && `${ruta}#${version}`;

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    api(ruta)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((err) => vigente && setResultado({ clave, error: err.message }));
    return () => {
      vigente = false;
    };
  }, [ruta, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const actual = resultado.clave === clave;

  return {
    // Mientras recarga se siguen mostrando los datos anteriores.
    datos: resultado.datos,
    error: actual ? resultado.error : null,
    cargando: Boolean(clave) && !actual,
    recargar,
  };
}

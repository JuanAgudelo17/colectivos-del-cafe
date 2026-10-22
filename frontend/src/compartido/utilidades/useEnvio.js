import { useCallback, useState } from 'react';

// Estado de un formulario que se envía al backend: enviando, error general y errores por campo.
export function useEnvio() {
  const [estado, setEstado] = useState({ enviando: false, error: null, campos: {} });

  const enviar = useCallback(async (accion) => {
    setEstado({ enviando: true, error: null, campos: {} });
    try {
      const resultado = await accion();
      setEstado({ enviando: false, error: null, campos: {} });
      return resultado;
    } catch (err) {
      setEstado({ enviando: false, error: err.message, campos: err.campos ?? {} });
      return undefined;
    }
  }, []);

  return { ...estado, enviar };
}

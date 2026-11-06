import { useState } from 'react';

// Botón para sacar las constancias de verificación del mes (los papelitos de
// las planillas) en PDF para imprimir y recortar. La librería se carga al tocarlo.
export function ImprimirConstancias({ mes }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  async function generar() {
    setGenerando(true);
    setError(null);
    try {
      const { exportarConstancias } = await import('./constancias.js');
      exportarConstancias(mes);
    } catch {
      setError('No se pudieron generar las constancias. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="boton-secundario-oscuro"
        disabled={!mes || generando}
        onClick={generar}
        title="Los papelitos de cada día para pegar en las planillas"
      >
        {generando ? 'Generando…' : 'Constancias para imprimir'}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </>
  );
}

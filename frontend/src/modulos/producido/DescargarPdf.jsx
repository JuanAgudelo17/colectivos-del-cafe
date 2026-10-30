import { useState } from 'react';

// Botón para descargar el mes en PDF. La librería del PDF se carga solo al
// tocarlo (no pesa en el resto de la app). `conductor`: nombre para el encabezado
// cuando el mes no lo trae (vista del conductor).
export function DescargarPdf({ mes, conductor, className = 'boton-secundario-oscuro' }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    try {
      const { exportarMesPdf } = await import('./pdf.js');
      exportarMesPdf(mes, { conductor });
    } catch {
      setError('No se pudo generar el PDF. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={!mes || generando} onClick={descargar}>
        {generando ? 'Generando…' : 'Descargar PDF'}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </>
  );
}

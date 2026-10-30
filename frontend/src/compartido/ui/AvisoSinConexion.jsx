import { useEffect, useState } from 'react';
import { EVENTO_CONEXION } from '../api.js';

const fechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

// Franja arriba del contenido cuando se está viendo lo guardado en el celular
// (sin señal o con señal tan mala que no alcanzó a cargar). Al volver la señal
// ofrece actualizar.
export function AvisoSinConexion() {
  const [sinRed, setSinRed] = useState(() => !navigator.onLine);
  const [guardadoEn, setGuardadoEn] = useState(null);

  useEffect(() => {
    const alPerder = () => setSinRed(true);
    const alVolver = () => setSinRed(false);
    // Cada respuesta dice si es guardada (con su fecha) o fresca (null).
    const alResponder = (e) => setGuardadoEn(e.detail);
    window.addEventListener('offline', alPerder);
    window.addEventListener('online', alVolver);
    window.addEventListener(EVENTO_CONEXION, alResponder);
    return () => {
      window.removeEventListener('offline', alPerder);
      window.removeEventListener('online', alVolver);
      window.removeEventListener(EVENTO_CONEXION, alResponder);
    };
  }, []);

  if (!sinRed && !guardadoEn) return null;

  // "… 9:14 a. m." ya termina en punto.
  const cuando = guardadoEn && fechaHora.format(new Date(guardadoEn));
  const desde = cuando ? ` Estás viendo lo guardado el ${cuando}${cuando.endsWith('.') ? '' : '.'}` : '';
  return (
    <div className="aviso-sin-conexion" role="status">
      <span aria-hidden="true">📶</span>
      <p>
        {sinRed ? (
          <>
            <strong>Sin señal.</strong>
            {desde || ' Lo que no se haya abierto antes no se puede ver.'} No se puede guardar nada hasta que vuelva.
          </>
        ) : (
          <>
            <strong>La señal está débil.</strong>
            {desde}
          </>
        )}
      </p>
      {!sinRed && (
        <button type="button" className="boton-enlace" onClick={() => window.location.reload()}>
          Actualizar
        </button>
      )}
    </div>
  );
}

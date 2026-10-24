import { Link } from 'react-router';
import { mesActual, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';

// Mini resumen del mes para el inicio del conductor: producido (bruto) y total
// neto, con un enlace directo a "Mi producido".
export function ResumenMiProducido() {
  const { anio, mes } = mesActual();
  const { datos } = useDatos(`/producido/mio?anio=${anio}&mes=${mes}`);
  if (!datos?.buseta) return null;

  const { resumen } = datos;
  const dias = resumen.diasTrabajados;

  return (
    <Link to="/conductor/mi-producido" className="resumen-inicio" aria-label="Ver mi producido">
      <span className="resumen-inicio-titulo">
        Producido de {nombreMes(anio, mes)}
        <small>
          {dias === 0 ? 'Aún no hay días registrados' : `${dias} ${dias === 1 ? 'día trabajado' : 'días trabajados'}`}
        </small>
      </span>
      <span className="resumen-inicio-cifras">
        <span>
          <small>Bruto</small>
          <strong>{pesos(resumen.bruto)}</strong>
        </span>
        <span>
          <small>Neto</small>
          <strong>{pesos(resumen.neto)}</strong>
        </span>
      </span>
      <span className="resumen-inicio-enlace">
        Ver mi producido <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

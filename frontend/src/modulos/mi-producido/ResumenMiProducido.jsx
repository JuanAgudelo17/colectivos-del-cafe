import { Link } from 'react-router';
import { nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useMesVigente } from '../../compartido/utilidades/useMesVigente.js';
import { rutaMio, tieneDatos } from './mesMio.js';

// Mini resumen del mes para el inicio del conductor: producido (bruto) y total
// neto, con un enlace directo a "Mi producido". Los primeros 15 días, mientras
// el mes nuevo no tenga días, muestra el anterior (ver useMesVigente).
export function ResumenMiProducido() {
  const { datos, periodo, deMesAnterior } = useMesVigente(rutaMio, tieneDatos);
  const { anio, mes } = periodo;
  if (!datos?.buseta) return null;

  const { resumen } = datos;
  const dias = resumen.diasTrabajados;

  return (
    <Link
      to={`/conductor/mi-producido?anio=${anio}&mes=${mes}`}
      className="resumen-inicio"
      aria-label="Ver mi producido"
    >
      <span className="resumen-inicio-titulo">
        Producido de {nombreMes(anio, mes)}
        <small>
          {dias === 0 ? 'Aún no hay días registrados' : `${dias} ${dias === 1 ? 'día trabajado' : 'días trabajados'}`}
          {deMesAnterior && ` · ${mesSiguiente(anio, mes)} aún sin días`}
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

// (2026, 10) → "Noviembre": el mes en curso, cuando se está mostrando el anterior.
function mesSiguiente(anio, mes) {
  const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
  return nombreMes(siguiente.anio, siguiente.mes).replace(/ de \d+$/, '').replace(/^./, (l) => l.toUpperCase());
}

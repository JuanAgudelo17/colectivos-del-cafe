import { pesos } from '../../compartido/utilidades/formato.js';
import { CONCEPTOS, porcentaje } from './utilidades.js';
import './rentabilidad.css';

// De cada peso producido, cuánto se fue en cada concepto y cuánto quedó.
// La barra es la parte del producido (el 100 % es todo lo producido).
export function DesgloseCostos({ total }) {
  const filas = CONCEPTOS.map(([clave, nombre]) => ({ clave, nombre, valor: total[clave] }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const ancho = (valor) => `${total.bruto > 0 ? Math.min(100, (Math.max(0, valor) / total.bruto) * 100) : 0}%`;

  return (
    <ul className="desglose">
      {filas.map((f) => (
        <li key={f.clave}>
          <span className="desglose-nombre">{f.nombre}</span>
          <span className="desglose-valor">
            {pesos(f.valor)} <small>{porcentaje(f.valor, total.bruto)}</small>
          </span>
          <span className="desglose-pista" aria-hidden="true">
            <span style={{ width: ancho(f.valor) }} />
          </span>
        </li>
      ))}
      <li className="desglose-utilidad">
        <span className="desglose-nombre">{total.neto < 0 ? 'Pérdida' : 'Lo que queda (utilidad)'}</span>
        <span className="desglose-valor">
          {pesos(total.neto)} <small>{porcentaje(total.neto, total.bruto)}</small>
        </span>
        <span className="desglose-pista" aria-hidden="true">
          <span style={{ width: ancho(total.neto) }} />
        </span>
      </li>
    </ul>
  );
}

import { fecha, nombreMes, numero, pesos } from '../../compartido/utilidades/formato.js';
import { NOMINA, OPERATIVOS } from './liquidacion.js';

// La liquidación mensual de la cooperativa, como el documento: total bruto,
// descuentos operativos y de nómina, y el neto a pagar. Los conceptos en cero
// no se muestran. `acciones`: botones del admin (corregir, reabrir).
export function LiquidacionCooperativa({ liquidacion: l, anio, mes, acciones = null }) {
  const lineas = (grupo) => grupo.filter(([clave]) => l[clave] > 0);

  return (
    <aside className="resumen-mes liquidacion" aria-label="Liquidación de la cooperativa">
      <div className="resumen-bruto">
        <span>
          Liquidación de la cooperativa · {nombreMes(anio, mes).replace(/^./, (letra) => letra.toUpperCase())}
        </span>
        <strong>{pesos(l.totalBruto)}</strong>
        <small>Total bruto{l.fecha && ` · liquidada el ${fecha(l.fecha)}`}</small>
      </div>

      {[
        ['Descuentos operativos', lineas(OPERATIVOS)],
        ['Descuentos de nómina', lineas(NOMINA)],
      ].map(
        ([titulo, filas]) =>
          filas.length > 0 && (
            <table key={titulo} className="resumen-tabla">
              <caption className="liquidacion-grupo">{titulo}</caption>
              <tbody>
                {filas.map(([clave, nombre]) => (
                  <tr key={clave}>
                    <th scope="row">{nombre}</th>
                    <td>− {numero(l[clave])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
      )}

      <div className={l.netoAPagar < 0 ? 'resumen-neto resumen-neto-negativo' : 'resumen-neto'}>
        <span>Neto a pagar</span>
        <strong>{pesos(l.netoAPagar)}</strong>
      </div>

      <p className="liquidacion-nota">
        Este mes se cerró con la liquidación de la cooperativa: estos valores mandan para el resumen y la
        rentabilidad.
      </p>
      {acciones}
    </aside>
  );
}

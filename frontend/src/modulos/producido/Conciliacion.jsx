import { numero, pesos } from '../../compartido/utilidades/formato.js';

// Diferencia con signo: "+ 50.000", "− 27.500" o "✓" si cuadra.
function Diferencia({ valor }) {
  if (valor === 0) return <span className="conciliacion-cuadra">✓ Igual</span>;
  return <strong>{`${valor > 0 ? '+' : '−'} ${numero(Math.abs(valor))}`}</strong>;
}

// Conciliación planilla vs. cooperativa: lo que da la cuadrícula del mes frente
// a la liquidación de la cooperativa, línea por línea. Diferencia = cooperativa −
// planilla (en un descuento, + = la cooperativa descontó más).
export function Conciliacion({ conciliacion: c }) {
  const diferentes = c.lineas.filter((l) => l.diferencia !== 0);

  return (
    <section className="conciliacion" aria-labelledby="titulo-conciliacion">
      <h2 id="titulo-conciliacion">Planilla vs. cooperativa</h2>
      <p className="detalle">
        {c.cuadra
          ? 'Todas las líneas coinciden con la cuadrícula del mes.'
          : `${diferentes.length} ${diferentes.length === 1 ? 'línea no coincide' : 'líneas no coinciden'} con la cuadrícula del mes. La diferencia es lo de la cooperativa menos lo de la planilla.`}
      </p>

      <div className="tabla-contenedor">
        <table className="tabla conciliacion-tabla">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col" className="numero">Planilla</th>
              <th scope="col" className="numero">Cooperativa</th>
              <th scope="col" className="numero">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {c.lineas.map((l) => (
              <tr key={l.clave} className={l.diferencia === 0 ? undefined : 'conciliacion-distinta'}>
                <td>
                  {l.nombre}
                  {l.nota && <small> · {l.nota}</small>}
                </td>
                <td className="numero" data-etiqueta="Planilla">{numero(l.planilla)}</td>
                <td className="numero" data-etiqueta="Cooperativa">{numero(l.cooperativa)}</td>
                <td className="numero" data-etiqueta="Diferencia">
                  <Diferencia valor={l.diferencia} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Neto</td>
              <td className="numero" data-etiqueta="Planilla">{pesos(c.neto.planilla)}</td>
              <td className="numero" data-etiqueta="Cooperativa">{pesos(c.neto.cooperativa)}</td>
              <td className="numero" data-etiqueta="Diferencia">
                <Diferencia valor={c.neto.diferencia} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {c.neto.diferencia !== 0 && (
        <p className="ayuda">
          {c.neto.diferencia > 0
            ? `La cooperativa paga ${pesos(c.neto.diferencia)} más de lo que da la planilla.`
            : `La cooperativa paga ${pesos(-c.neto.diferencia)} menos de lo que da la planilla.`}
        </p>
      )}
    </section>
  );
}

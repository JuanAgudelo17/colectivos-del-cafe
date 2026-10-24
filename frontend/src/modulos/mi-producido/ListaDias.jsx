import { diasDelMes, numero, pesos } from '../../compartido/utilidades/formato.js';

// Cada día trabajado como una fila: el día grande, el producido destacado y lo
// que se gastó ese día (peajes, salidas y ACPM; La Guaca solo si tanqueó allá).
// Al final, el total del mes.
export function ListaDias({ anio, mes, dias, totales, mejor }) {
  const semana = Object.fromEntries(diasDelMes(anio, mes).map((d) => [d.fecha, d.semana]));
  const conGuaca = totales.acpmCredito > 0;
  const gastos = (d) =>
    [
      ['Peajes', d.peajes],
      ['Salidas', d.salidas],
      ['ACPM', d.acpm],
      conGuaca && ['ACPM Guaca', d.acpmCredito],
    ].filter(Boolean);

  return (
    <>
      <ol className="mp-dias">
        {dias.map((d) => (
          <li key={d.fecha} className={d === mejor ? 'mp-dia mp-dia-mejor' : 'mp-dia'}>
            <span className="mp-dia-fecha" aria-label={`${semana[d.fecha]} ${Number(d.fecha.slice(8))}`}>
              <strong>{Number(d.fecha.slice(8))}</strong>
              <small>{semana[d.fecha]}</small>
            </span>
            <span className="mp-dia-producido">
              <small>Producido</small>
              <strong>{pesos(d.ingreso)}</strong>
              {(d === mejor || d.relevo) && (
                <span className="mp-dia-etiquetas">
                  {d === mejor && <span className="etiqueta etiqueta-oscura">Mejor día</span>}
                  {d.relevo && <span className="etiqueta">Relevo</span>}
                </span>
              )}
            </span>
            <dl className="mp-dia-gastos">
              {gastos(d).map(([texto, valor]) => (
                <div key={texto} className={valor === 0 ? 'mp-dia-cero' : undefined}>
                  <dt>{texto}</dt>
                  <dd>{valor === 0 ? '—' : numero(valor)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>

      <div className="mp-dia mp-dias-total">
        <span className="mp-dia-fecha">
          <strong>Σ</strong>
          <small>Total</small>
        </span>
        <span className="mp-dia-producido">
          <small>
            {totales.diasTrabajados} {totales.diasTrabajados === 1 ? 'día' : 'días'}
          </small>
          <strong>{pesos(totales.ingreso)}</strong>
        </span>
        <dl className="mp-dia-gastos">
          {gastos(totales).map(([texto, valor]) => (
            <div key={texto}>
              <dt>{texto}</dt>
              <dd>{numero(valor)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

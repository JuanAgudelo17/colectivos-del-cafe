import { useState } from 'react';
import { SelectorMes } from '../../compartido/ui/SelectorMes.jsx';
import { mesActual, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './ranking.css';

// Las busetas ordenadas por lo producido en el mes (sin descontar nada) y los
// días trabajados. La barra es el producido comparado con el de la primera.
export function PaginaRanking() {
  const [periodo, setPeriodo] = useState(mesActual);
  const { datos, error, cargando } = useDatos(`/ranking?anio=${periodo.anio}&mes=${periodo.mes}`);
  const vigente = datos && datos.anio === periodo.anio && datos.mes === periodo.mes ? datos : null;
  const maximo = Math.max(1, ...(vigente?.busetas.map((b) => b.bruto) ?? []));
  const nadie = vigente && vigente.busetas.every((b) => b.bruto === 0);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Ranking</h1>
          <p className="subtitulo">Las busetas ordenadas por lo que produjeron en el mes.</p>
        </div>
      </div>

      <div className="ranking-filtros">
        <SelectorMes valor={periodo} alCambiar={setPeriodo} />
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !vigente && <p className="vacio">Cargando…</p>}
      {nadie && <p className="vacio">Todavía no hay producido registrado en {nombreMes(periodo.anio, periodo.mes)}.</p>}

      {vigente && !nadie && (
        <ol className="ranking-lista" aria-label={`Ranking de ${nombreMes(vigente.anio, vigente.mes)}`}>
          {vigente.busetas.map((b) => (
            <li key={b.id} className={b.propia ? 'ranking-fila ranking-propia' : 'ranking-fila'}>
              <span className={b.puesto === 1 ? 'ranking-puesto ranking-primero' : 'ranking-puesto'}>
                {b.puesto ?? '—'}
              </span>
              <span className="ranking-buseta">
                <strong>{b.numeroInterno}</strong> · {b.placa}
                {b.propia && <span className="etiqueta etiqueta-oscura">Tu buseta</span>}
              </span>
              <span className="ranking-datos">
                <strong>{pesos(b.bruto)}</strong>
                <small>
                  {b.diasTrabajados} {b.diasTrabajados === 1 ? 'día trabajado' : 'días trabajados'}
                </small>
              </span>
              <span className="ranking-pista" aria-hidden="true">
                <span style={{ width: `${(b.bruto / maximo) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

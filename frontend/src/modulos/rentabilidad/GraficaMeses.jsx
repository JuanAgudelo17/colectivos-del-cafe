import { useState } from 'react';
import { pesos } from '../../compartido/utilidades/formato.js';
import { mesCorto, mesLargo, porcentaje } from './utilidades.js';
import './rentabilidad.css';

// El detalle se abre centrado sobre la barra, pero pegado al borde en los
// extremos para no salirse de la gráfica.
function posicionDetalle(centro) {
  const desplazar = centro > 0.7 ? '-100%' : centro < 0.3 ? '0' : '-50%';
  return { left: `${centro * 100}%`, transform: `translateX(${desplazar})` };
}

// Utilidad de cada mes en barras: hacia arriba lo que dejó, hacia abajo (rayada)
// la pérdida. Al pasar el mouse o tocar una barra se ve el detalle del mes.
// La tabla "Mes a mes" de la página tiene los mismos datos.
export function GraficaMeses({ meses, ultimoMes }) {
  const [activo, setActivo] = useState(null);
  const delMes = new Map(meses.map((m) => [m.mes, m]));
  const columnas = Array.from({ length: ultimoMes }, (_, i) => i + 1);

  const maximo = Math.max(0, ...meses.map((m) => m.neto));
  const minimo = Math.min(0, ...meses.map((m) => m.neto));
  const rango = maximo - minimo || 1;
  // Altura de la parte positiva (el resto queda para las pérdidas).
  const arriba = (maximo / rango) * 100;
  const detalle = activo && delMes.get(activo);

  return (
    <div className="grafica" onMouseLeave={() => setActivo(null)}>
      <div className="grafica-escala" aria-hidden="true">
        <span style={{ top: 0 }}>{maximo > 0 ? pesos(maximo) : ''}</span>
        <span style={{ top: `${arriba}%` }}>$ 0</span>
        {minimo < 0 && <span style={{ top: '100%' }}>{pesos(minimo)}</span>}
      </div>

      <div className="grafica-area" style={{ '--columnas': columnas.length }}>
        <div className="grafica-cero" style={{ top: `${arriba}%` }} aria-hidden="true" />
        {columnas.map((mes) => {
          const m = delMes.get(mes);
          const alto = m ? (Math.abs(m.neto) / rango) * 100 : 0;
          const texto = m
            ? `${mesLargo(mes)}: ${m.neto < 0 ? 'pérdida' : 'utilidad'} ${pesos(m.neto)}${m.enCurso ? ' (en curso)' : ''}`
            : `${mesLargo(mes)}: sin registros`;
          return (
            <button
              key={mes}
              type="button"
              className={`grafica-columna${activo === mes ? ' grafica-activa' : ''}`}
              aria-label={texto}
              onMouseEnter={() => setActivo(mes)}
              onFocus={() => setActivo(mes)}
              onBlur={() => setActivo(null)}
              onClick={() => setActivo(mes)}
            >
              {m && (
                <span
                  className={`grafica-barra${m.neto < 0 ? ' grafica-perdida' : ''}${m.enCurso ? ' grafica-en-curso' : ''}`}
                  style={
                    m.neto < 0
                      ? { top: `${arriba}%`, height: `${alto}%` }
                      : { bottom: `${100 - arriba}%`, height: `${alto}%` }
                  }
                />
              )}
              <span className={`grafica-mes${m ? '' : ' grafica-sin-datos'}`}>{mesCorto(mes)}</span>
            </button>
          );
        })}

        {activo && (
          <div
            className="grafica-detalle"
            style={posicionDetalle((activo - 0.5) / columnas.length)}
            role="status"
          >
            <strong>
              {mesLargo(activo)}
              {detalle?.enCurso && <span className="etiqueta">En curso</span>}
            </strong>
            {detalle ? (
              <dl>
                <div>
                  <dt>{detalle.neto < 0 ? 'Pérdida' : 'Utilidad'}</dt>
                  <dd>{pesos(detalle.neto)}</dd>
                </div>
                <div>
                  <dt>Producido</dt>
                  <dd>{pesos(detalle.bruto)}</dd>
                </div>
                <div>
                  <dt>Margen</dt>
                  <dd>{porcentaje(detalle.neto, detalle.bruto)}</dd>
                </div>
              </dl>
            ) : (
              <p>Sin registros</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

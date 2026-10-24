import { useState } from 'react';
import { CampoSeleccion } from '../../compartido/ui/Campos.jsx';
import { diasDelMes, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import {
  DesgloseCostos,
  GraficaMeses,
  diasConRegistro,
  mesLargo,
  porDia,
  porcentaje,
  promedio,
} from '../rentabilidad/index.js';
import './mi-rentabilidad.css';

// Días de cada mes que ya pasaron (el mes en curso, hasta hoy): para saber
// cuántos días estuvo parada la buseta.
function diasCorridos(anio, mes, mesActual) {
  if (anio === mesActual.anio && mes === mesActual.mes) return Number(hoyBogota().slice(8));
  return diasDelMes(anio, mes).length;
}

// Rentabilidad de la buseta del conductor, pensada para el dueño del carro:
// cuánto deja al año y este mes, cómo va a cerrar el mes, cuánto rinde cada
// día trabajado, en qué se va la plata y cómo se calcula. Solo su buseta.
export function PaginaMiRentabilidad() {
  const [anio, setAnio] = useState(null); // null = el año actual
  const { datos, error, cargando } = useDatos(anio ? `/rentabilidad/mia?anio=${anio}` : '/rentabilidad/mia');
  const vigente = datos && (anio === null || datos.anio === anio) ? datos : null;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Rentabilidad</h1>
          <p className="subtitulo">
            Cuánto deja tu buseta después de pagar todo: la empresa, el conductor, el combustible y los demás gastos.
          </p>
        </div>
        {vigente?.buseta && (
          <span className="mr-buseta">
            {vigente.buseta.numeroInterno} · {vigente.buseta.placa}
          </span>
        )}
      </div>

      {datos?.anios?.length > 1 && (
        <div className="mr-filtros">
          <CampoSeleccion
            etiqueta="Año"
            valor={anio ?? datos.anio}
            alCambiar={setAnio}
            opciones={datos.anios.map((a) => ({ valor: a, texto: String(a) }))}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {cargando && !vigente && <p className="vacio">Cargando…</p>}
      {vigente && !vigente.buseta && <p className="mr-vacio">Aún no tienes buseta asignada.</p>}
      {vigente?.buseta && vigente.meses.length === 0 && (
        <p className="mr-vacio">Todavía no hay producido registrado en {vigente.anio}.</p>
      )}
      {vigente?.buseta && vigente.meses.length > 0 && <Rentabilidad datos={vigente} />}
    </>
  );
}

function Rentabilidad({ datos }) {
  const { total, meses, anio, mesActual, buseta } = datos;
  const enCurso = meses.find((m) => m.enCurso);
  // Los días solo cuentan en los meses con días registrados (no en los de liquidación).
  const conDias = meses.filter((m) => !m.deLiquidacion);
  const trabajados = diasConRegistro(meses);
  const corridos = conDias.reduce((t, m) => t + diasCorridos(anio, m.mes, mesActual), 0);
  const sinTrabajar = Math.max(corridos - trabajados, 0);
  const quedan = total.bruto > 0 ? Math.round((total.neto / total.bruto) * 100) : 0;

  return (
    <div className="mr-cuerpo">
      <section className="mr-principal" aria-label={`Utilidad de ${anio}`}>
        <span className="mr-principal-titulo">{total.neto < 0 ? 'Pérdida' : 'Utilidad'} de {anio}</span>
        <strong className="mr-principal-valor">{pesos(total.neto)}</strong>
        <p>
          De {pesos(total.bruto)} producidos, quedaron <strong>$ {quedan} de cada $ 100</strong>.
        </p>
        <small>
          {meses.length} {meses.length === 1 ? 'mes con registro' : 'meses con registro'}
        </small>
      </section>

      {enCurso && <EsteMes mes={enCurso} proyeccion={datos.proyeccion} corridos={diasCorridos(anio, enCurso.mes, mesActual)} />}

      <section aria-labelledby="titulo-claves">
        <h2 id="titulo-claves">Lo que más importa</h2>
        <div className="mr-datos">
          <Dato
            texto="Utilidad promedio por mes"
            valor={pesos(promedio(total.neto, meses.length))}
            nota={enCurso ? 'Incluye el mes en curso' : undefined}
          />
          <Dato texto="Producido por día trabajado" valor={pesos(porDia(meses, 'bruto'))} />
          <Dato
            texto="Utilidad por día trabajado"
            valor={pesos(porDia(meses, 'neto'))}
            nota="Lo que deja, en promedio, cada día que sale"
          />
          <Dato
            texto="Días trabajados"
            valor={`${trabajados} de ${corridos}`}
            nota={
              sinTrabajar > 0
                ? `${sinTrabajar} ${sinTrabajar === 1 ? 'día' : 'días'} sin producido`
                : 'Trabajó todos los días'
            }
          />
          <Dato
            texto="Combustible (ACPM)"
            valor={porcentaje(total.acpm, total.bruto)}
            nota={`del producido · ${pesos(total.acpm)}`}
          />
          <Dato texto="Mantenimiento" valor={pesos(total.mantenimiento)} nota={`En ${anio}`} />
        </div>
      </section>

      <div className="mr-columnas">
        <section aria-labelledby="titulo-meses">
          <h2 id="titulo-meses">Utilidad mes a mes</h2>
          <GraficaMeses meses={meses} ultimoMes={datos.ultimoMes} />
          <TablaMeses anio={anio} meses={meses} mesActual={mesActual} />
        </section>

        <section aria-labelledby="titulo-desglose">
          <h2 id="titulo-desglose">En qué se va la plata</h2>
          <p className="mr-ayuda">Parte de lo producido en {anio}.</p>
          <DesgloseCostos total={total} />
        </section>
      </div>

      <ComoSeCalcula tieneCupo={buseta.tieneCupo} />
    </div>
  );
}

// El mes en curso: cómo va hasta hoy y, si ya hay suficientes días, cómo cerraría.
function EsteMes({ mes, proyeccion, corridos }) {
  return (
    <section className="mr-mes" aria-labelledby="titulo-este-mes">
      <h2 id="titulo-este-mes">{mesLargo(mes.mes)} va así</h2>
      <dl className="mr-mes-datos">
        <div>
          <dt>Utilidad hasta hoy</dt>
          <dd>{pesos(mes.neto)}</dd>
        </div>
        <div>
          <dt>Producido</dt>
          <dd>{pesos(mes.bruto)}</dd>
        </div>
        <div>
          <dt>Días trabajados</dt>
          <dd>
            {mes.diasTrabajados} de {corridos}
          </dd>
        </div>
      </dl>
      {proyeccion ? (
        <p className="mr-proyeccion">
          Si sigue a este ritmo, cerraría el mes con un producido de <strong>{pesos(proyeccion.bruto)}</strong> y una
          utilidad de <strong>{pesos(proyeccion.neto)}</strong>.
          <small>
            Es un estimado: supone que la buseta trabaja igual los {proyeccion.diasDelMes - proyeccion.diasTranscurridos}{' '}
            días que faltan. El sueldo y los fijos ya se descuentan completos, por eso la utilidad de hoy se ve baja.
          </small>
        </p>
      ) : (
        <p className="mr-proyeccion">
          <small>Todavía es muy pronto en el mes para estimar cómo va a cerrar.</small>
        </p>
      )}
    </section>
  );
}

function Dato({ texto, valor, nota }) {
  return (
    <div className="mr-dato">
      <span>{texto}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

function TablaMeses({ anio, meses, mesActual }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla mr-tabla">
        <thead>
          <tr>
            <th>Mes</th>
            <th className="numero">Producido</th>
            <th className="numero">Utilidad</th>
            <th className="numero">De cada $ 100</th>
            <th className="numero">Días</th>
          </tr>
        </thead>
        <tbody>
          {[...meses].reverse().map((m) => (
            <tr key={m.mes}>
              <td>
                {mesLargo(m.mes)}
                {m.enCurso && <span className="etiqueta">En curso</span>}
              </td>
              <td className="numero" data-etiqueta="Producido">
                {pesos(m.bruto)}
              </td>
              <td className="numero" data-etiqueta="Utilidad">
                <strong>{pesos(m.neto)}</strong>
              </td>
              <td className="numero" data-etiqueta="De cada $ 100">
                {m.bruto > 0 ? `$ ${Math.round((m.neto / m.bruto) * 100)}` : '—'}
              </td>
              <td className="numero" data-etiqueta="Días">
                {m.deLiquidacion ? 'Liquidación' : `${m.diasTrabajados} de ${diasCorridos(anio, m.mes, mesActual)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// La fórmula en palabras sencillas (la misma de la planilla).
function ComoSeCalcula({ tieneCupo }) {
  return (
    <details className="mr-como">
      <summary>¿Cómo se calcula la utilidad?</summary>
      <p>Es lo que queda de lo producido después de descontar, cada mes:</p>
      <ul>
        <li>
          <strong>20 % para la empresa</strong> (Colectivos del Café), sobre todo lo producido.
        </li>
        <li>
          <strong>Fondo de reposición:</strong>{' '}
          {tieneCupo ? 'el 1 % de lo producido.' : 'un valor fijo al mes (la buseta paga arriendo).'}
        </li>
        {!tieneCupo && (
          <li>
            <strong>Arriendo</strong> del cupo.
          </li>
        )}
        <li>
          <strong>Sueldo del conductor</strong> y los <strong>relevos</strong> (días en que trabaja un reemplazo).
        </li>
        <li>
          <strong>Peajes, salidas y ACPM</strong> de cada día (incluido el ACPM a crédito en La Guaca).
        </li>
        <li>
          <strong>Mantenimiento</strong>, <strong>préstamos</strong>, <strong>bonos</strong> y el{' '}
          <strong>seguro contractual</strong> (de febrero a julio).
        </li>
      </ul>
      <p>Es el mismo cálculo del resumen de "Mi producido" (el total neto de cada mes).</p>
    </details>
  );
}

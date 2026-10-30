import { useSearchParams } from 'react-router';
import { useSesion } from '../../compartido/sesion/contexto.js';
import { mesActual, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { AvisoColpass } from '../colpass/index.js';
import { DescargarPdf, LiquidacionCooperativa, ResumenMes } from '../producido/index.js';
import { GraficaDias } from './GraficaDias.jsx';
import { ListaDias } from './ListaDias.jsx';
import { NavegadorMes } from './NavegadorMes.jsx';
import './mi-producido.css';

// Mes de la dirección (?anio=2026&mes=9, como lo traen los avisos); si no es
// válido o es futuro, el actual.
function mesDelEnlace(parametros) {
  const anio = Number(parametros.get('anio'));
  const mes = Number(parametros.get('mes'));
  const hoy = mesActual();
  const valido = anio >= 2020 && mes >= 1 && mes <= 12 && anio * 12 + mes <= hoy.anio * 12 + hoy.mes;
  return valido ? { anio, mes } : hoy;
}

// El conductor consulta lo que hizo cada día y el resumen del mes de su buseta
// (en qué se gastó), todo de solo lectura. Lo de La Guaca solo aparece si ese
// mes tanqueó allá. El mes vive en la dirección: cambiarlo con las flechas la
// actualiza, así un aviso siempre lleva al mes que dice.
export function PaginaMiProducido() {
  const { usuario } = useSesion();
  const [parametros, setParametros] = useSearchParams();
  const periodo = mesDelEnlace(parametros);
  const setPeriodo = ({ anio, mes }) => setParametros({ anio: String(anio), mes: String(mes) }, { replace: true });
  const { datos, error, cargando } = useDatos(`/producido/mio?anio=${periodo.anio}&mes=${periodo.mes}`);
  const vigente = datos && datos.anio === periodo.anio && datos.mes === periodo.mes ? datos : null;
  const hoy = mesActual();
  const enCurso = periodo.anio === hoy.anio && periodo.mes === hoy.mes;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Mi producido</h1>
          <p className="subtitulo">Lo que hiciste cada día y en qué se gastó lo producido.</p>
        </div>
        {vigente?.buseta && (
          <div className="mp-cabeza-acciones">
            <span className="mp-buseta">
              {vigente.buseta.numeroInterno} · {vigente.buseta.placa}
            </span>
            {(vigente.dias.length > 0 || vigente.liquidacion) && (
              <DescargarPdf mes={vigente} conductor={usuario.nombre} />
            )}
          </div>
        )}
      </div>

      <AvisoColpass />

      <NavegadorMes valor={periodo} alCambiar={setPeriodo} />

      {error && <p className="error">{error}</p>}
      {cargando && !vigente && <p className="vacio">Cargando…</p>}

      {vigente && !vigente.buseta && (
        <p className="mp-vacio">Aún no tienes buseta asignada. Cuando la tengas, aquí verás tu producido.</p>
      )}

      {vigente?.buseta && vigente.dias.length === 0 && !vigente.liquidacion && (
        <p className="mp-vacio">
          Todavía no hay días registrados en {nombreMes(periodo.anio, periodo.mes)}. El administrador los registra con
          las planillas.
        </p>
      )}

      {/* Mes cerrado con la liquidación de la cooperativa y sin días registrados: solo el documento */}
      {vigente?.buseta && vigente.dias.length === 0 && vigente.liquidacion && (
        <section className="mp-solo-liquidacion" aria-label="Liquidación del mes">
          <LiquidacionCooperativa liquidacion={vigente.liquidacion} anio={vigente.anio} mes={vigente.mes} />
        </section>
      )}

      {vigente?.buseta && vigente.dias.length > 0 && (
        <Mes mes={vigente} enCurso={enCurso} />
      )}
    </>
  );
}

function Mes({ mes, enCurso }) {
  const { totales, resumen, dias } = mes;
  const trabajados = dias.filter((d) => d.ingreso > 0);
  const promedio = trabajados.length > 0 ? Math.round(totales.ingreso / trabajados.length) : 0;
  const mejor = trabajados.reduce((m, d) => (d.ingreso > (m?.ingreso ?? 0) ? d : m), null);
  const conGuaca = totales.acpmCredito > 0;

  return (
    <div className="mp-cuerpo">
      <section className="mp-principal" aria-label="Producido del mes">
        <span className="mp-principal-titulo">
          Producido de {nombreMes(mes.anio, mes.mes)}
          {enCurso && <span className="etiqueta">En curso</span>}
        </span>
        <strong className="mp-principal-valor">{pesos(totales.ingreso)}</strong>
        <dl className="mp-principal-datos">
          <div>
            <dt>Total neto</dt>
            <dd>{pesos(resumen.neto)}</dd>
          </div>
          <div>
            <dt>Días trabajados</dt>
            <dd>{totales.diasTrabajados}</dd>
          </div>
          {resumen.diasRelevo > 0 && (
            <div>
              <dt>Días de relevo</dt>
              <dd>{resumen.diasRelevo}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mp-datos" aria-label="Datos del mes">
        <Dato texto="Promedio por día" valor={pesos(promedio)} />
        <Dato
          texto="Mejor día"
          valor={pesos(mejor?.ingreso ?? 0)}
          nota={mejor && `El ${Number(mejor.fecha.slice(8))}`}
        />
        <Dato texto="Peajes" valor={pesos(totales.peajes)} />
        <Dato texto="Salidas" valor={pesos(totales.salidas)} />
        <Dato texto="ACPM" valor={pesos(totales.acpm)} nota={conGuaca && 'Lo que pagaste tú'} />
        {conGuaca && <Dato texto="ACPM La Guaca" valor={pesos(totales.acpmCredito)} nota="A crédito" />}
      </section>

      <section className="mp-grafica-seccion" aria-labelledby="titulo-grafica">
        <h2 id="titulo-grafica">Producido por día</h2>
        <GraficaDias anio={mes.anio} mes={mes.mes} dias={dias} promedio={promedio} />
      </section>

      <section className="mp-resumen" aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen">En qué se gastó</h2>
        {mes.liquidacion ? (
          <LiquidacionCooperativa liquidacion={mes.liquidacion} anio={mes.anio} mes={mes.mes} />
        ) : (
          <ResumenMes mes={mes} soloLectura />
        )}
      </section>

      <section className="mp-dias-seccion" aria-labelledby="titulo-dias">
        <h2 id="titulo-dias">Día por día</h2>
        <ListaDias anio={mes.anio} mes={mes.mes} dias={dias} totales={totales} mejor={mejor} />
      </section>
    </div>
  );
}

function Dato({ texto, valor, nota }) {
  return (
    <div className="mp-dato">
      <span>{texto}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

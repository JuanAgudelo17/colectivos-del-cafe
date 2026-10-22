import { Link } from 'react-router';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Indicador } from '../../compartido/ui/Indicador.jsx';
import { fecha, fechaLargaHoy } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './dashboard.css';

const DOCUMENTOS = [
  ['soat', 'SOAT'],
  ['tecnomecanica', 'Tecnomecánica'],
];

// Panel general del admin: indicadores de la flota y documentos que requieren atención.
export function Dashboard() {
  const busetasDatos = useDatos('/busetas');
  const conductoresDatos = useDatos('/conductores');
  const busetas = busetasDatos.datos?.busetas.filter((b) => b.activo);
  const conductores = conductoresDatos.datos?.conductores.filter((c) => c.activo);

  const alertas = (busetas ?? [])
    .flatMap((b) =>
      DOCUMENTOS.map(([clave, nombre]) => ({ buseta: b, nombre, documento: b.documentos[clave] })).filter(
        ({ documento }) => documento.estado === 'vencido' || documento.estado === 'por_vencer',
      ),
    )
    .sort((a, b) => a.documento.dias - b.documento.dias);

  const vencidos = busetas && alertas.filter((a) => a.documento.estado === 'vencido').length;
  const porVencer = busetas && alertas.length - vencidos;
  const sinConductor = busetas?.filter((b) => !b.conductor).length;
  const error = busetasDatos.error ?? conductoresDatos.error;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Panel general</h1>
          <p className="subtitulo">{fechaLargaHoy()}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="indicadores" aria-label="Indicadores">
        <Indicador
          etiqueta="Busetas activas"
          valor={busetas?.length}
          nota={sinConductor ? `${sinConductor} sin conductor` : busetas && 'Todas con conductor'}
        />
        <Indicador etiqueta="Conductores activos" valor={conductores?.length} />
        <Indicador
          etiqueta="Documentos vencidos"
          valor={vencidos}
          estado={vencidos === undefined ? undefined : vencidos > 0 ? 'critico' : 'bien'}
        />
        <Indicador
          etiqueta="Vencen en 30 días o menos"
          valor={porVencer}
          estado={porVencer === undefined ? undefined : porVencer > 0 ? 'advertencia' : 'bien'}
        />
      </section>

      <div className="dashboard-columnas">
        <section className="tarjeta">
          <h2>Documentos que requieren atención</h2>
          {busetas && alertas.length === 0 && <p className="ok">Todos los documentos están al día. ✅</p>}
          {alertas.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Buseta</th>
                    <th>Documento</th>
                    <th>Vence</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map(({ buseta, nombre, documento }) => (
                    <tr key={`${buseta.id}-${nombre}`}>
                      <td>
                        <strong>{buseta.numeroInterno}</strong> · {buseta.placa}
                      </td>
                      <td>{nombre}</td>
                      <td className="numero">{fecha(documento.fecha)}</td>
                      <td>
                        <EstadoDocumento documento={documento} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta-encabezado">
            <h2>Estado de la flota</h2>
            <Link to="busetas">Ver busetas →</Link>
          </div>
          {busetas?.length === 0 && (
            <p className="vacio">
              Aún no hay busetas. <Link to="busetas">Registra la primera</Link>.
            </p>
          )}
          {busetas?.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Buseta</th>
                    <th>Conductor</th>
                    <th>SOAT</th>
                    <th>Tecnomecánica</th>
                  </tr>
                </thead>
                <tbody>
                  {busetas.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.numeroInterno}</strong> · {b.placa}
                      </td>
                      <td>{b.conductor?.nombre ?? <span className="sin-asignar">Sin asignar</span>}</td>
                      <td>
                        <EstadoDocumento documento={b.documentos.soat} compacto />
                      </td>
                      <td>
                        <EstadoDocumento documento={b.documentos.tecnomecanica} compacto />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

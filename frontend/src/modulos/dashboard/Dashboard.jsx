import { Link } from 'react-router';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Indicador } from '../../compartido/ui/Indicador.jsx';
import { DOCUMENTOS, requiereAtencion } from '../../compartido/utilidades/documentos.js';
import { fecha, fechaLargaHoy } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { EstadoMantenimiento, requiereAtencion as mantenimientoRequiereAtencion } from '../mantenimiento/index.js';
import { SolicitudesRecuperacion } from './SolicitudesRecuperacion.jsx';
import './dashboard.css';

const GRAVEDAD = { vencido: 0, pronto: 1, sin_registro: 2, al_dia: 3 };

// Panel general del admin: indicadores de la flota y lo que requiere atención
// (documentos por vencer y mantenimientos vencidos o próximos).
export function Dashboard() {
  const busetasDatos = useDatos('/busetas');
  const conductoresDatos = useDatos('/conductores');
  const mantenimientoDatos = useDatos('/mantenimiento');
  const busetas = busetasDatos.datos?.busetas.filter((b) => b.activo);
  const conductores = conductoresDatos.datos?.conductores.filter((c) => c.activo);
  const mantenimientoDe = new Map(mantenimientoDatos.datos?.busetas.map((m) => [m.id, m]));

  const alertas = (busetas ?? [])
    .flatMap((b) =>
      DOCUMENTOS.map(({ clave, nombre }) => ({ buseta: b, nombre, documento: b.documentos[clave] })).filter(
        ({ documento }) => requiereAtencion(documento),
      ),
    )
    .sort((a, b) => a.documento.dias - b.documento.dias);

  const alertasMantenimiento = (mantenimientoDatos.datos?.busetas ?? [])
    .flatMap((m) => m.estados.filter(mantenimientoRequiereAtencion).map((estado) => ({ buseta: m, estado })))
    .sort((a, b) => GRAVEDAD[a.estado.estado] - GRAVEDAD[b.estado.estado]);
  const mantenimientosVencidos =
    mantenimientoDatos.datos && alertasMantenimiento.filter((a) => a.estado.estado === 'vencido').length;

  // El estado más grave de los mantenimientos de una buseta (para la tabla de la flota).
  const peorMantenimiento = (id) =>
    [...(mantenimientoDe.get(id)?.estados ?? [])].sort((a, b) => GRAVEDAD[a.estado] - GRAVEDAD[b.estado])[0];

  const vencidos = busetas && alertas.filter((a) => a.documento.estado === 'vencido').length;
  const porVencer = busetas && alertas.length - vencidos;
  const sinConductor = busetas?.filter((b) => !b.conductor).length;
  const error = busetasDatos.error ?? conductoresDatos.error ?? mantenimientoDatos.error;

  const estadoDe = (n, siHay) => (n === undefined ? undefined : n > 0 ? siHay : 'bien');

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <p className="fecha-hoy">{fechaLargaHoy()}</p>
          <h1>Panel general</h1>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <SolicitudesRecuperacion />

      <section className="indicadores" aria-label="Indicadores">
        <Indicador
          etiqueta="Busetas activas"
          valor={busetas?.length}
          nota={busetas && (sinConductor ? `${sinConductor} sin conductor asignado` : 'Todas con conductor')}
        />
        <Indicador etiqueta="Conductores activos" valor={conductores?.length} />
        <Indicador etiqueta="Documentos vencidos" valor={vencidos} estado={estadoDe(vencidos, 'critico')} />
        <Indicador
          etiqueta="Vencen en 30 días o menos"
          valor={porVencer}
          estado={estadoDe(porVencer, 'advertencia')}
        />
        <Indicador
          etiqueta="Mantenimientos vencidos"
          valor={mantenimientosVencidos}
          estado={estadoDe(mantenimientosVencidos, 'critico')}
        />
      </section>

      <div className="dashboard-columnas">
        <section>
          <h2>Documentos que requieren atención</h2>
          {busetas && alertas.length === 0 && (
            <p className="dashboard-vacio">✓ Todos los documentos de la flota están al día.</p>
          )}
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
                      <td data-etiqueta="">{nombre}</td>
                      <td className="numero" data-etiqueta="Vence">{fecha(documento.fecha)}</td>
                      <td>
                        <EstadoDocumento documento={documento} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="dashboard-subtitulo">Mantenimiento que requiere atención</h2>
          {mantenimientoDatos.datos && alertasMantenimiento.length === 0 && (
            <p className="dashboard-vacio">✓ No hay mantenimientos vencidos ni próximos.</p>
          )}
          {alertasMantenimiento.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Buseta</th>
                    <th>Mantenimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasMantenimiento.map(({ buseta, estado }) => (
                    <tr key={`${buseta.id}-${estado.tipo}`}>
                      <td>
                        <Link to={`busetas/${buseta.id}`}>
                          <strong>{buseta.numeroInterno}</strong> · {buseta.placa}
                        </Link>
                      </td>
                      <td data-etiqueta="">{estado.nombre}</td>
                      <td>
                        <EstadoMantenimiento estado={estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="seccion-encabezado">
            <h2>Estado de la flota</h2>
            <Link to="busetas">Ver busetas</Link>
          </div>
          {busetas?.length === 0 && (
            <div className="dashboard-vacio">
              <p>Aún no hay busetas registradas.</p>
              <Link to="busetas" className="boton-principal">
                Registrar la primera buseta
              </Link>
            </div>
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
                    <th>Mantenimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {busetas.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link to={`busetas/${b.id}`}>
                          <strong>{b.numeroInterno}</strong> · {b.placa}
                        </Link>
                      </td>
                      <td data-etiqueta="Conductor">{b.conductor?.nombre ?? <span className="sin-asignar">Sin asignar</span>}</td>
                      <td data-etiqueta="SOAT">
                        <EstadoDocumento documento={b.documentos.soat} compacto />
                      </td>
                      <td data-etiqueta="Tecnomecánica">
                        <EstadoDocumento documento={b.documentos.tecnomecanica} compacto />
                      </td>
                      <td data-etiqueta="Mantenimiento">
                        {peorMantenimiento(b.id) && <EstadoMantenimiento estado={peorMantenimiento(b.id)} compacto />}
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

import { Link } from 'react-router';
import { useSesion } from '../../compartido/sesion/contexto.js';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { IlustracionBuseta } from '../../compartido/ui/Ilustraciones.jsx';
import { fecha, fechaLargaHoy, textoDocumento } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './mi-buseta.css';

const DOCUMENTOS = [
  ['soat', 'SOAT'],
  ['tecnomecanica', 'Tecnomecánica'],
];

// Panel del conductor: su buseta, el estado de sus documentos y lo que viene.
export function MiBuseta() {
  const { usuario } = useSesion();
  const { datos, error, cargando } = useDatos('/mi-buseta');
  const buseta = datos?.buseta;
  const primerNombre = usuario.nombre.split(' ')[0];

  const alertas = buseta
    ? DOCUMENTOS.filter(([clave]) => ['vencido', 'por_vencer'].includes(buseta.documentos[clave].estado))
    : [];

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <p className="fecha-hoy">{fechaLargaHoy()}</p>
          <h1>Hola, {primerNombre}</h1>
          <p className="subtitulo">Así está tu buseta hoy.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}

      {datos && !buseta && (
        <section className="mi-buseta-tarjeta">
          <div className="mi-buseta-datos">
            <h2>Aún no tienes buseta asignada</h2>
            <p className="detalle">
              Cuando el administrador te asigne una, aquí vas a ver su información y el estado del SOAT y la
              tecnomecánica.
            </p>
          </div>
          <div className="mi-buseta-ilustracion">
            <IlustracionBuseta />
          </div>
        </section>
      )}

      {buseta && (
        <>
          {alertas.length > 0 && (
            <div className="aviso mi-buseta-alerta" role="alert">
              {alertas.map(([clave, nombre]) => (
                <p key={clave}>
                  <strong>{nombre}:</strong> {textoDocumento(buseta.documentos[clave]).toLowerCase()}.
                </p>
              ))}
              <p>Avísale al administrador para renovarlo a tiempo.</p>
            </div>
          )}

          <section className="mi-buseta-tarjeta">
            <div className="mi-buseta-datos">
              <div className="etiquetas">
                <span className="etiqueta">{buseta.tieneCupo ? 'Con cupo' : 'Sin cupo'}</span>
                {!buseta.activo && <span className="etiqueta etiqueta-oscura">Inactiva</span>}
              </div>
              <span className="mi-buseta-rotulo">Tu buseta</span>
              <p className="mi-buseta-placa">
                {buseta.numeroInterno} · {buseta.placa}
              </p>
              <p className="detalle">{buseta.modelo ?? 'Modelo sin registrar'}</p>
            </div>
            <div className="mi-buseta-ilustracion">
              <IlustracionBuseta />
            </div>
          </section>

          <section className="seccion">
            <h2>Documentos</h2>
            <div className="mi-buseta-documentos">
              {DOCUMENTOS.map(([clave, nombre]) => {
                const documento = buseta.documentos[clave];
                return (
                  <article key={clave} className="tarjeta mi-buseta-documento">
                    <div className="mi-buseta-documento-titulo">
                      <Icono nombre="documento" />
                      <h3>{nombre}</h3>
                    </div>
                    <p className="mi-buseta-vence">
                      {documento.fecha ? `Vence el ${fecha(documento.fecha)}` : 'Sin fecha registrada'}
                    </p>
                    <EstadoDocumento documento={documento} />
                  </article>
                );
              })}
            </div>
            <p className="ayuda">Las fechas las actualiza el administrador. Si ves algo mal, avísale.</p>
          </section>
        </>
      )}

      {datos && (
        <section className="seccion">
          <h2>Más opciones</h2>
          <div className="mi-buseta-documentos">
            <Link to="/conductor/mi-producido" className="tarjeta mi-buseta-enlace">
              <div className="mi-buseta-documento-titulo">
                <Icono nombre="dinero" />
                <h3>Mi producido</h3>
                <span aria-hidden="true">→</span>
              </div>
              <p className="detalle">Consulta lo que hiciste cada día: producido, peajes, salidas y ACPM.</p>
            </Link>
            <article className="tarjeta mi-buseta-pronto">
              <div className="mi-buseta-documento-titulo">
                <Icono nombre="factura" />
                <h3>Mis facturas</h3>
                <span className="etiqueta">Fase 2</span>
              </div>
              <p className="detalle">Sube tus gastos de peajes, ACPM y mantenimiento con foto.</p>
            </article>
          </div>
        </section>
      )}
    </>
  );
}

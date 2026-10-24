import { Link } from 'react-router';
import { useSesion } from '../../compartido/sesion/contexto.js';
import { IlustracionBuseta } from '../../compartido/ui/Ilustraciones.jsx';
import { DOCUMENTOS } from '../../compartido/utilidades/documentos.js';
import { fecha, fechaLargaHoy, kilometros, textoDocumento } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { FotoBuseta } from '../busetas/index.js';
import { PanelMantenimiento, requiereAtencion as mantenimientoRequiereAtencion, textoEstado } from '../mantenimiento/index.js';
import { ResumenMiProducido } from '../mi-producido/index.js';
import './mi-buseta.css';

// Inicio del conductor: el producido del mes, su buseta con el estado de un
// vistazo (documentos, kilometraje, mantenimiento), lo que requiere atención y
// el mantenimiento. Los documentos en detalle están en su propio módulo.
export function MiBuseta() {
  const { usuario } = useSesion();
  const { datos, error, cargando } = useDatos('/mi-buseta');
  const buseta = datos?.buseta;
  const primerNombre = usuario.nombre.split(' ')[0];

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
        <section className="mi-buseta-tarjeta mi-buseta-sin">
          <div className="mi-buseta-datos">
            <h2>Aún no tienes buseta asignada</h2>
            <p className="detalle">
              Cuando el administrador te asigne una, aquí vas a ver su información, sus documentos y llevar al día
              el kilometraje y los mantenimientos.
            </p>
          </div>
          <div className="mi-buseta-ilustracion">
            <IlustracionBuseta />
          </div>
        </section>
      )}

      {buseta && <ConBuseta buseta={buseta} />}
    </>
  );
}

function ConBuseta({ buseta }) {
  const hoja = useDatos(`/mantenimiento/${buseta.id}`).datos;
  const documentos = DOCUMENTOS.map((d) => ({ ...d, documento: buseta.documentos[d.clave] }));
  const vencidos = documentos.filter((d) => d.documento.estado === 'vencido');
  const porVencer = documentos.filter((d) => d.documento.estado === 'por_vencer');
  const mantenimientos = (hoja?.estados ?? []).filter(mantenimientoRequiereAtencion);
  const nadaRegistrado = hoja?.estados.every((e) => e.estado === 'sin_registro');

  // Lo urgente primero: documentos vencidos, mantenimientos vencidos, y luego lo próximo.
  const atencion = [
    ...vencidos.map((d) => ({ clave: d.clave, gravedad: 0, titulo: d.nombre, texto: textoDocumento(d.documento), a: 'documentos' })),
    ...mantenimientos
      .filter((m) => m.estado === 'vencido')
      .map((m) => ({ clave: m.tipo, gravedad: 0, titulo: m.nombre, texto: textoEstado(m) })),
    ...porVencer.map((d) => ({ clave: d.clave, gravedad: 1, titulo: d.nombre, texto: textoDocumento(d.documento), a: 'documentos' })),
    ...mantenimientos
      .filter((m) => m.estado !== 'vencido')
      .map((m) => ({ clave: m.tipo, gravedad: 1, titulo: m.nombre, texto: textoEstado(m) })),
  ];

  const estadoDocumentos = vencidos.length
    ? { gravedad: 0, texto: `${vencidos.length} vencido${vencidos.length > 1 ? 's' : ''}${porVencer.length ? ` · ${porVencer.length} por vencer` : ''}` }
    : porVencer.length
      ? { gravedad: 1, texto: `${porVencer.length} por vencer` }
      : { gravedad: 2, texto: 'Todos al día' };

  return (
    <>
      <ResumenMiProducido />

      <div className="mi-buseta-principal">
        <section className="mi-buseta-tarjeta" aria-label="Tu buseta">
          <div className="mi-buseta-ilustracion">
            <FotoBuseta src="/mi-buseta/foto" foto={buseta.foto} alt={`Tu buseta ${buseta.placa}`} />
          </div>
          <div className="mi-buseta-datos">
            <span className="mi-buseta-rotulo">Tu buseta</span>
            <p className="mi-buseta-placa">
              {buseta.numeroInterno} · {buseta.placa}
            </p>
            <p className="detalle">{buseta.modelo ?? 'Modelo sin registrar'}</p>
            <div className="etiquetas">
              <span className="etiqueta">{buseta.tieneCupo ? 'Con cupo' : 'Sin cupo'}</span>
              {!buseta.activo && <span className="etiqueta etiqueta-oscura">Inactiva</span>}
            </div>
          </div>
        </section>

        <section className="mi-buseta-estado" aria-labelledby="titulo-estado">
          <h2 id="titulo-estado">Estado</h2>
          <ul>
            <li>
              <Link to="/conductor/documentos">
                <Indicador gravedad={estadoDocumentos.gravedad} />
                <span>
                  <strong>Documentos</strong>
                  <small>{estadoDocumentos.texto}</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <a href="#mantenimiento">
                <Indicador gravedad={hoja?.kilometraje ? 2 : 1} />
                <span>
                  <strong>Kilometraje</strong>
                  <small>
                    {hoja?.kilometraje
                      ? `${kilometros(hoja.kilometraje.actual)} · ${fecha(hoja.kilometraje.fecha)}`
                      : 'Sin reportar'}
                  </small>
                </span>
                <span aria-hidden="true">↓</span>
              </a>
            </li>
            <li>
              <a href="#mantenimiento">
                <Indicador
                  gravedad={
                    mantenimientos.some((m) => m.estado === 'vencido') ? 0 : mantenimientos.length || nadaRegistrado ? 1 : 2
                  }
                />
                <span>
                  <strong>Mantenimiento</strong>
                  <small>
                    {!hoja
                      ? 'Cargando…'
                      : mantenimientos.length
                        ? `${mantenimientos.length} por atender`
                        : nadaRegistrado
                          ? 'Sin registros todavía'
                          : 'Nada pendiente'}
                  </small>
                </span>
                <span aria-hidden="true">↓</span>
              </a>
            </li>
          </ul>
        </section>
      </div>

      {atencion.length > 0 && (
        <section className="mi-buseta-atencion" aria-labelledby="titulo-atencion">
          <h2 id="titulo-atencion">Requiere atención</h2>
          <ul>
            {atencion.map((a) => (
              <li key={`${a.a ?? 'mant'}-${a.clave}`} className={a.gravedad === 0 ? 'atencion-grave' : 'atencion-pronto'}>
                <span aria-hidden="true">{a.gravedad === 0 ? '⛔' : '⚠️'}</span>
                <span>
                  <strong>{a.titulo}</strong> · {a.texto}
                </span>
                {a.a === 'documentos' && <Link to="/conductor/documentos">Ver</Link>}
              </li>
            ))}
          </ul>
          {vencidos.length + porVencer.length > 0 && (
            <p className="ayuda">Los documentos los renueva el administrador: avísale a tiempo.</p>
          )}
        </section>
      )}

      <div id="mantenimiento">
        <PanelMantenimiento busetaId={buseta.id} accionFija resumido />
      </div>
    </>
  );
}

// Punto de estado con icono y texto oculto para lectores (nunca solo color).
function Indicador({ gravedad }) {
  const { icono, texto } = [
    { icono: '⛔', texto: 'Requiere atención' },
    { icono: '⚠️', texto: 'Revisar pronto' },
    { icono: '✓', texto: 'Al día' },
  ][gravedad];
  return (
    <span className={`mi-buseta-indicador mi-buseta-indicador-${gravedad}`} role="img" aria-label={texto}>
      {icono}
    </span>
  );
}

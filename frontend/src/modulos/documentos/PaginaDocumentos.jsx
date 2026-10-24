import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { DOCUMENTOS } from '../../compartido/utilidades/documentos.js';
import { fecha } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import './documentos.css';

// Para qué sirve cada documento, en palabras sencillas.
const EXPLICACION = {
  soat: 'Seguro obligatorio: cubre a las personas heridas en un accidente.',
  tecnomecanica: 'Revisión técnico-mecánica y de gases. Sin ella no se puede circular.',
  tarjetaOperacion: 'Permiso para prestar el servicio de transporte con la empresa.',
  polizaRcc: 'Responde por los pasajeros si les pasa algo en el viaje.',
  polizaRce: 'Responde por daños a terceros (otros carros, peatones, bienes).',
  extintor: 'Fecha en que vence la recarga del extintor.',
};

// Primero lo vencido, luego lo que vence pronto, lo vigente y lo sin fecha.
const ORDEN = { vencido: 0, por_vencer: 1, vigente: 2, sin_fecha: 3 };

const RESUMEN = [
  { estado: 'vencido', texto: 'Vencidos', icono: '⛔' },
  { estado: 'por_vencer', texto: 'Por vencer', icono: '⚠️' },
  { estado: 'vigente', texto: 'Al día', icono: '✅' },
  { estado: 'sin_fecha', texto: 'Sin fecha', icono: '❔' },
];

// Documentos de la buseta del conductor: cuáles requieren atención y cuándo
// vence cada uno. Solo consulta; las fechas las actualiza el administrador.
export function PaginaDocumentos() {
  const { datos, error, cargando } = useDatos('/mi-buseta');
  const buseta = datos?.buseta;
  const documentos = buseta
    ? DOCUMENTOS.map((d) => ({ ...d, documento: buseta.documentos[d.clave] })).sort(
        (a, b) =>
          ORDEN[a.documento.estado] - ORDEN[b.documento.estado] || (a.documento.dias ?? 0) - (b.documento.dias ?? 0),
      )
    : [];
  const cuantos = (estado) => documentos.filter((d) => d.documento.estado === estado).length;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Documentos</h1>
          <p className="subtitulo">Cuándo vence cada documento de tu buseta.</p>
        </div>
        {buseta && (
          <span className="doc-buseta">
            {buseta.numeroInterno} · {buseta.placa}
          </span>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}
      {datos && !buseta && <p className="vacio">Aún no tienes buseta asignada.</p>}

      {buseta && (
        <>
          <ul className="doc-resumen" aria-label="Resumen de documentos">
            {RESUMEN.map(({ estado, texto, icono }) => (
              <li key={estado} className={`doc-resumen-${estado}`}>
                <strong>{cuantos(estado)}</strong>
                <span>
                  <span aria-hidden="true">{icono}</span> {texto}
                </span>
              </li>
            ))}
          </ul>

          {cuantos('vencido') + cuantos('por_vencer') > 0 && (
            <p className="aviso doc-aviso">
              Avísale al administrador para renovar a tiempo lo que está vencido o por vencer.
            </p>
          )}

          <ol className="doc-lista">
            {documentos.map(({ clave, nombre, documento }) => (
              <li key={clave} className={`doc-item doc-item-${documento.estado}`}>
                <span className="doc-icono" aria-hidden="true">
                  <Icono nombre="documento" tamano={22} />
                </span>
                <div className="doc-texto">
                  <h2>{nombre}</h2>
                  <p>{EXPLICACION[clave]}</p>
                </div>
                <div className="doc-vence">
                  {documento.fecha && <span className="doc-vence-fecha">Vence el {fecha(documento.fecha)}</span>}
                  <EstadoDocumento documento={documento} />
                </div>
              </li>
            ))}
          </ol>

          <p className="ayuda">Las fechas las actualiza el administrador. Si ves algo mal, avísale.</p>
        </>
      )}
    </>
  );
}

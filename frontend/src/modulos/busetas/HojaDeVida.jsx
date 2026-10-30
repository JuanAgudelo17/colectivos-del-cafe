import { useState } from 'react';
import { useParams } from 'react-router';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { DOCUMENTOS } from '../../compartido/utilidades/documentos.js';
import { fecha, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { PanelMantenimiento } from '../mantenimiento/index.js';
import { FormularioBuseta } from './FormularioBuseta.jsx';
import { FotoBuseta } from './FotoBuseta.jsx';
import { SubirFoto } from './SubirFoto.jsx';
import './busetas.css';

// Hoja de vida de una buseta (admin): foto, datos, documentos, kilometraje y mantenimientos.
export function HojaDeVida() {
  const { id } = useParams();
  const { datos, error, recargar } = useDatos(`/busetas/${id}`);
  const [editando, setEditando] = useState(false);
  const buseta = datos?.buseta;

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!datos && !error && <p className="vacio">Cargando…</p>}

      {buseta && (
        <>
          <div className="titulo-pagina">
            <div>
              <h1>
                {buseta.numeroInterno} · {buseta.placa}
              </h1>
              <p className="subtitulo">Hoja de vida de la buseta</p>
            </div>
            <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(true)}>
              Editar datos y documentos
            </button>
          </div>

          <section className="hoja-tarjeta">
            <div className="hoja-datos">
              <div className="etiquetas">
                <span className="etiqueta">{buseta.tieneCupo ? 'Con cupo' : 'Sin cupo'}</span>
                {!buseta.activo && <span className="etiqueta etiqueta-oscura">Inactiva</span>}
              </div>
              <dl>
                <dt>Modelo</dt>
                <dd>{buseta.modelo ?? 'Sin registrar'}</dd>
                <dt>Conductor</dt>
                <dd>{buseta.conductor?.nombre ?? 'Sin asignar'}</dd>
                {!buseta.tieneCupo && (
                  <>
                    <dt>Arriendo mensual</dt>
                    <dd>{pesos(buseta.valorArriendo)}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className="hoja-foto">
              <div className="hoja-foto-marco">
                <FotoBuseta src={`/busetas/${buseta.id}/foto`} foto={buseta.foto} alt={`Buseta ${buseta.placa}`} />
              </div>
              <SubirFoto buseta={buseta} alCambiar={recargar} />
            </div>
          </section>

          <section className="seccion">
            <h2>Documentos</h2>
            <div className="hoja-documentos">
              {DOCUMENTOS.map(({ clave, nombre }) => {
                const documento = buseta.documentos[clave];
                return (
                  <article key={clave} className="tarjeta hoja-documento">
                    <div className="hoja-documento-titulo">
                      <Icono nombre="documento" />
                      <h3>{nombre}</h3>
                    </div>
                    <p className="detalle">{documento.fecha ? `Vence el ${fecha(documento.fecha)}` : 'Sin fecha registrada'}</p>
                    <EstadoDocumento documento={documento} />
                  </article>
                );
              })}
            </div>
          </section>

          <PanelMantenimiento busetaId={buseta.id} />

          <Dialogo abierto={editando} titulo={`Editar buseta ${buseta.placa}`} alCerrar={() => setEditando(false)}>
            <FormularioBuseta
              inicial={buseta}
              alGuardar={() => {
                setEditando(false);
                recargar();
              }}
            />
          </Dialogo>
        </>
      )}
    </>
  );
}

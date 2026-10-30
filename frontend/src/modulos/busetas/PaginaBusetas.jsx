import { useState } from 'react';
import { Link } from 'react-router';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { Pestanas } from '../../compartido/ui/Pestanas.jsx';
import { DOCUMENTOS } from '../../compartido/utilidades/documentos.js';
import { pesos } from '../../compartido/utilidades/formato.js';
import { FILTROS_ACTIVO, opcionesActivo } from '../../compartido/utilidades/filtros.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { IntervalosMantenimiento } from '../mantenimiento/index.js';
import { FormularioBuseta } from './FormularioBuseta.jsx';

const NUEVA = {
  numeroInterno: '',
  placa: '',
  modelo: '',
  tieneCupo: true,
  valorArriendo: null,
  fechaSoat: '',
  fechaTecnomecanica: '',
  activo: true,
};

export function PaginaBusetas() {
  const { datos, error, cargando, recargar } = useDatos('/busetas');
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('activos');
  const [verIntervalos, setVerIntervalos] = useState(false);
  const busetas = datos?.busetas.filter(FILTROS_ACTIVO[filtro]);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Busetas</h1>
          <p className="subtitulo">Flota, documentos y hoja de vida de cada buseta.</p>
        </div>
        <div className="acciones">
          <button type="button" className="boton-secundario-oscuro" onClick={() => setVerIntervalos(true)}>
            Intervalos de mantenimiento
          </button>
          <button type="button" className="boton-principal" onClick={() => setEditando(NUEVA)}>
            + Nueva buseta
          </button>
        </div>
      </div>

      <Pestanas
        etiqueta="Filtrar busetas"
        opciones={opcionesActivo(datos?.busetas, { activos: 'Activas', inactivos: 'Inactivas' })}
        valor={filtro}
        alCambiar={setFiltro}
      />

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}
      {busetas?.length === 0 && (
        <p className="vacio">
          {datos.busetas.length === 0 ? 'Todavía no hay busetas registradas.' : 'No hay busetas en este filtro.'}
        </p>
      )}

      <ul className="lista">
        {busetas?.map((b) => (
          <li key={b.id} className={b.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              <div className="etiquetas">
                <span className="etiqueta">{b.tieneCupo ? 'Con cupo' : 'Sin cupo'}</span>
                {!b.activo && <span className="etiqueta etiqueta-oscura">Inactiva</span>}
              </div>
              <h3>
                {b.numeroInterno} · {b.placa}
              </h3>
              <p className="detalle">{b.modelo ?? 'Sin modelo'}</p>
              <p className="detalle">Conductor: {b.conductor?.nombre ?? 'sin asignar'}</p>
              {!b.tieneCupo && <p className="detalle">Arriendo mensual: {pesos(b.valorArriendo)}</p>}
              <div className="documentos">
                {DOCUMENTOS.map(({ clave, nombre }) => (
                  <EstadoDocumento key={clave} nombre={nombre} documento={b.documentos[clave]} compacto />
                ))}
              </div>
            </div>
            <div className="item-acciones">
              <Link to={String(b.id)} className="boton-principal">
                Hoja de vida
              </Link>
              <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(b)}>
                Editar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialogo
        abierto={editando !== null}
        titulo={editando?.id ? `Editar buseta ${editando.placa}` : 'Nueva buseta'}
        alCerrar={() => setEditando(null)}
      >
        <FormularioBuseta
          inicial={editando}
          alGuardar={() => {
            setEditando(null);
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo abierto={verIntervalos} titulo="Intervalos de mantenimiento" alCerrar={() => setVerIntervalos(false)}>
        <IntervalosMantenimiento />
      </Dialogo>
    </>
  );
}

import { useState } from 'react';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { EstadoDocumento } from '../../compartido/ui/EstadoDocumento.jsx';
import { pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
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

  return (
    <>
      <div className="titulo-pagina">
        <h1>Busetas</h1>
        <button type="button" className="boton-principal" onClick={() => setEditando(NUEVA)}>
          + Nueva buseta
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p>Cargando…</p>}
      {datos?.busetas.length === 0 && <p className="vacio">Todavía no hay busetas registradas.</p>}

      <ul className="lista">
        {datos?.busetas.map((b) => (
          <li key={b.id} className={b.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              <h3>
                {b.numeroInterno} · {b.placa} {!b.activo && <span className="etiqueta">Inactiva</span>}
              </h3>
              <p className="detalle">
                {b.modelo ?? 'Sin modelo'} · {b.tieneCupo ? 'Con cupo' : `Sin cupo · Arriendo ${pesos(b.valorArriendo)}`}
              </p>
              <p className="detalle">Conductor: {b.conductor?.nombre ?? 'sin asignar'}</p>
              <div className="documentos">
                <EstadoDocumento nombre="SOAT" documento={b.documentos.soat} />
                <EstadoDocumento nombre="Tecnomecánica" documento={b.documentos.tecnomecanica} />
              </div>
            </div>
            <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(b)}>
              Editar
            </button>
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
    </>
  );
}

import { useState } from 'react';
import { api } from '../../api.js';
import { CampoPesos, CampoSeleccion, CampoTexto, Interruptor } from '../../componentes/Campos.jsx';
import { Dialogo } from '../../componentes/Dialogo.jsx';
import { EstadoDocumento } from '../../componentes/EstadoDocumento.jsx';
import { FiltroEmpresa } from '../../componentes/FiltroEmpresa.jsx';
import { pesos } from '../../utilidades/formato.js';
import { useDatos } from '../../utilidades/useDatos.js';
import { useEnvio } from '../../utilidades/useEnvio.js';

const NUEVA = {
  empresaId: null,
  numeroInterno: '',
  placa: '',
  modelo: '',
  tieneCupo: true,
  valorArriendo: null,
  fechaSoat: '',
  fechaTecnomecanica: '',
  activo: true,
};

export function Busetas() {
  const [empresaId, setEmpresaId] = useState(null);
  const empresas = useDatos('/empresas').datos?.empresas;
  const { datos, error, cargando, recargar } = useDatos(`/busetas${empresaId ? `?empresaId=${empresaId}` : ''}`);
  const [editando, setEditando] = useState(null);

  const empresasActivas = empresas?.filter((e) => e.activo) ?? [];

  return (
    <>
      <div className="titulo-pagina">
        <h1>Busetas</h1>
        <button
          type="button"
          className="boton-principal"
          disabled={empresasActivas.length === 0}
          onClick={() => setEditando({ ...NUEVA, empresaId: empresaId ?? empresasActivas[0]?.id ?? null })}
        >
          + Nueva buseta
        </button>
      </div>

      <FiltroEmpresa empresas={empresas} valor={empresaId} alCambiar={setEmpresaId} />

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
                {b.modelo ?? 'Sin modelo'} · {b.empresaNombre}
              </p>
              <p className="detalle">
                {b.tieneCupo ? 'Con cupo' : `Sin cupo · Arriendo ${pesos(b.valorArriendo)}`} · Conductor:{' '}
                {b.conductor?.nombre ?? 'sin asignar'}
              </p>
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
          empresas={empresasActivas}
          alGuardar={() => {
            setEditando(null);
            recargar();
          }}
        />
      </Dialogo>
    </>
  );
}

function FormularioBuseta({ inicial, empresas, alGuardar }) {
  const [buseta, setBuseta] = useState({
    ...inicial,
    modelo: inicial.modelo ?? '',
    fechaSoat: inicial.fechaSoat ?? '',
    fechaTecnomecanica: inicial.fechaTecnomecanica ?? '',
  });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setBuseta((b) => ({ ...b, [campo]: valor }));
  const esNueva = !inicial.id;

  async function guardar(evento) {
    evento.preventDefault();
    const { empresaId, numeroInterno, placa, modelo, tieneCupo, valorArriendo, fechaSoat, fechaTecnomecanica, activo } =
      buseta;
    const comun = { numeroInterno, placa, modelo, tieneCupo, valorArriendo, fechaSoat, fechaTecnomecanica };
    const ok = await enviar(() =>
      esNueva
        ? api('/busetas', { method: 'POST', cuerpo: { empresaId, ...comun } })
        : api(`/busetas/${inicial.id}`, { method: 'PUT', cuerpo: { ...comun, activo } }),
    );
    if (ok) alGuardar();
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}

      {esNueva && empresas.length > 1 && (
        <CampoSeleccion
          etiqueta="Empresa"
          valor={buseta.empresaId}
          alCambiar={cambiar('empresaId')}
          opciones={empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
          error={campos.empresaId}
        />
      )}

      <div className="fila">
        <CampoTexto
          etiqueta="Número interno"
          valor={buseta.numeroInterno}
          alCambiar={cambiar('numeroInterno')}
          error={campos.numeroInterno}
          required
        />
        <CampoTexto
          etiqueta="Placa"
          valor={buseta.placa}
          alCambiar={(v) => cambiar('placa')(v.toUpperCase())}
          error={campos.placa}
          placeholder="ABC123"
          autoCapitalize="characters"
          required
        />
      </div>
      <CampoTexto etiqueta="Modelo" valor={buseta.modelo} alCambiar={cambiar('modelo')} error={campos.modelo} />

      <Interruptor etiqueta="Tiene cupo" valor={buseta.tieneCupo} alCambiar={cambiar('tieneCupo')} />
      {!buseta.tieneCupo && (
        <CampoPesos
          etiqueta="Valor del arriendo mensual"
          valor={buseta.valorArriendo}
          alCambiar={cambiar('valorArriendo')}
          error={campos.valorArriendo}
          ayuda="Se descuenta en el cierre de cada mes"
        />
      )}

      <fieldset>
        <legend>Vencimiento de documentos</legend>
        <div className="fila">
          <CampoTexto
            etiqueta="SOAT"
            type="date"
            valor={buseta.fechaSoat}
            alCambiar={cambiar('fechaSoat')}
            error={campos.fechaSoat}
          />
          <CampoTexto
            etiqueta="Tecnomecánica"
            type="date"
            valor={buseta.fechaTecnomecanica}
            alCambiar={cambiar('fechaTecnomecanica')}
            error={campos.fechaTecnomecanica}
          />
        </div>
      </fieldset>

      {!esNueva && <Interruptor etiqueta="Activa" valor={buseta.activo} alCambiar={cambiar('activo')} />}

      <button type="submit" className="boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

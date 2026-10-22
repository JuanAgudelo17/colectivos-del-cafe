import { useState } from 'react';
import { api } from '../../api.js';
import { CampoTexto, Interruptor } from '../../componentes/Campos.jsx';
import { Dialogo } from '../../componentes/Dialogo.jsx';
import { useSesion } from '../../sesion/contexto.js';
import { useDatos } from '../../utilidades/useDatos.js';
import { useEnvio } from '../../utilidades/useEnvio.js';

const NUEVA = { nombre: '', nit: '', activo: true };

export function Empresas() {
  const { usuario } = useSesion();
  const { datos, error, cargando, recargar } = useDatos('/empresas');
  const [editando, setEditando] = useState(null);
  const esGlobal = usuario.empresaId === null;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Empresas</h1>
        {esGlobal && (
          <button type="button" className="boton-principal" onClick={() => setEditando(NUEVA)}>
            + Nueva empresa
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p>Cargando…</p>}

      <ul className="lista">
        {datos?.empresas.map((e) => (
          <li key={e.id} className={e.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              <h3>
                {e.nombre} {!e.activo && <span className="etiqueta">Inactiva</span>}
              </h3>
              <p className="detalle">NIT: {e.nit ?? '—'}</p>
              <p className="detalle">
                {e.busetas} busetas · {e.conductores} conductores activos
              </p>
            </div>
            <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(e)}>
              Editar
            </button>
          </li>
        ))}
      </ul>

      <Dialogo
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar empresa' : 'Nueva empresa'}
        alCerrar={() => setEditando(null)}
      >
        <FormularioEmpresa
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

function FormularioEmpresa({ inicial, alGuardar }) {
  const [empresa, setEmpresa] = useState({ ...inicial, nit: inicial.nit ?? '' });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setEmpresa((e) => ({ ...e, [campo]: valor }));

  async function guardar(evento) {
    evento.preventDefault();
    const cuerpo = { nombre: empresa.nombre, nit: empresa.nit, activo: empresa.activo };
    const ok = await enviar(() =>
      inicial.id
        ? api(`/empresas/${inicial.id}`, { method: 'PUT', cuerpo })
        : api('/empresas', { method: 'POST', cuerpo }),
    );
    if (ok) alGuardar();
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <CampoTexto etiqueta="Nombre" valor={empresa.nombre} alCambiar={cambiar('nombre')} error={campos.nombre} required />
      <CampoTexto etiqueta="NIT" valor={empresa.nit} alCambiar={cambiar('nit')} error={campos.nit} inputMode="numeric" />
      {inicial.id && (
        <Interruptor
          etiqueta="Activa (si la desactivas, sus conductores no pueden entrar)"
          valor={empresa.activo}
          alCambiar={cambiar('activo')}
        />
      )}
      <button type="submit" className="boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

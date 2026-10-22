import { useState } from 'react';
import { api } from '../../api.js';
import { CampoSeleccion, CampoTexto, Interruptor } from '../../componentes/Campos.jsx';
import { Dialogo } from '../../componentes/Dialogo.jsx';
import { FiltroEmpresa } from '../../componentes/FiltroEmpresa.jsx';
import { PasswordUnaVez } from '../../componentes/PasswordUnaVez.jsx';
import { useDatos } from '../../utilidades/useDatos.js';
import { useEnvio } from '../../utilidades/useEnvio.js';

const NUEVO = { empresaId: null, usuario: '', nombre: '', cedula: '', telefono: '', busetaId: null, activo: true };

export function Conductores() {
  const [empresaId, setEmpresaId] = useState(null);
  const empresas = useDatos('/empresas').datos?.empresas;
  const { datos, error, cargando, recargar } = useDatos(
    `/conductores${empresaId ? `?empresaId=${empresaId}` : ''}`,
  );
  const [editando, setEditando] = useState(null);
  // { usuario, password } recién generados, para mostrarlos una sola vez.
  const [credenciales, setCredenciales] = useState(null);
  const restablecer = useEnvio();

  const empresasActivas = empresas?.filter((e) => e.activo) ?? [];

  async function restablecerPassword(conductor) {
    if (!window.confirm(`¿Generar una contraseña nueva para ${conductor.nombre}? La actual dejará de funcionar.`)) {
      return;
    }
    const r = await restablecer.enviar(() =>
      api(`/conductores/${conductor.id}/restablecer-password`, { method: 'POST' }),
    );
    if (r) setCredenciales({ usuario: conductor.usuario, password: r.password });
  }

  return (
    <>
      <div className="titulo-pagina">
        <h1>Conductores</h1>
        <button
          type="button"
          className="boton-principal"
          disabled={empresasActivas.length === 0}
          onClick={() => setEditando({ ...NUEVO, empresaId: empresaId ?? empresasActivas[0]?.id ?? null })}
        >
          + Nuevo conductor
        </button>
      </div>

      <FiltroEmpresa empresas={empresas} valor={empresaId} alCambiar={setEmpresaId} />

      {(error || restablecer.error) && <p className="error">{error ?? restablecer.error}</p>}
      {cargando && !datos && <p>Cargando…</p>}
      {datos?.conductores.length === 0 && <p className="vacio">Todavía no hay conductores registrados.</p>}

      <ul className="lista">
        {datos?.conductores.map((c) => (
          <li key={c.id} className={c.activo ? 'tarjeta item' : 'tarjeta item inactivo'}>
            <div className="item-principal">
              <h3>
                {c.nombre} {!c.activo && <span className="etiqueta">Inactivo</span>}
              </h3>
              <p className="detalle">
                Usuario: <code>{c.usuario}</code> · {c.empresaNombre}
              </p>
              <p className="detalle">
                Buseta: {c.busetaPlaca ? `${c.busetaNumeroInterno} · ${c.busetaPlaca}` : 'sin asignar'}
                {c.telefono && ` · Tel: ${c.telefono}`}
              </p>
            </div>
            <div className="item-acciones">
              <button type="button" className="boton-secundario-oscuro" onClick={() => setEditando(c)}>
                Editar
              </button>
              <button
                type="button"
                className="boton-enlace"
                disabled={restablecer.enviando}
                onClick={() => restablecerPassword(c)}
              >
                Restablecer contraseña
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialogo
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar conductor' : 'Nuevo conductor'}
        alCerrar={() => setEditando(null)}
      >
        <FormularioConductor
          inicial={editando}
          empresas={empresasActivas}
          alGuardar={(resultado) => {
            setEditando(null);
            if (resultado.password) {
              setCredenciales({ usuario: resultado.conductor.usuario, password: resultado.password });
            }
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo abierto={credenciales !== null} titulo="Datos de acceso" alCerrar={() => setCredenciales(null)}>
        <PasswordUnaVez {...credenciales} alTerminar={() => setCredenciales(null)} />
      </Dialogo>
    </>
  );
}

function FormularioConductor({ inicial, empresas, alGuardar }) {
  const [conductor, setConductor] = useState({
    ...inicial,
    cedula: inicial.cedula ?? '',
    telefono: inicial.telefono ?? '',
  });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setConductor((c) => ({ ...c, [campo]: valor }));
  const esNuevo = !inicial.id;

  // Busetas que se le pueden asignar: activas, de su empresa, libres o ya suyas.
  const busetas = useDatos(conductor.empresaId ? `/busetas?empresaId=${conductor.empresaId}` : null).datos?.busetas;
  const opcionesBuseta = (busetas ?? [])
    .filter((b) => b.activo && (!b.conductor || b.conductor.id === inicial.id))
    .map((b) => ({ valor: b.id, texto: `${b.numeroInterno} · ${b.placa}` }));

  async function guardar(evento) {
    evento.preventDefault();
    const { empresaId, usuario, nombre, cedula, telefono, busetaId, activo } = conductor;
    const comun = { usuario, nombre, cedula, telefono, busetaId };
    const resultado = await enviar(() =>
      esNuevo
        ? api('/conductores', { method: 'POST', cuerpo: { empresaId, ...comun } })
        : api(`/conductores/${inicial.id}`, { method: 'PUT', cuerpo: { ...comun, activo } }),
    );
    if (resultado) alGuardar(resultado);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}

      {esNuevo && empresas.length > 1 && (
        <CampoSeleccion
          etiqueta="Empresa"
          valor={conductor.empresaId}
          alCambiar={(v) => setConductor((c) => ({ ...c, empresaId: v, busetaId: null }))}
          opciones={empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
          error={campos.empresaId}
        />
      )}

      <CampoTexto
        etiqueta="Nombre completo"
        valor={conductor.nombre}
        alCambiar={cambiar('nombre')}
        error={campos.nombre}
        required
      />
      <CampoTexto
        etiqueta="Usuario para entrar"
        valor={conductor.usuario}
        alCambiar={(v) => cambiar('usuario')(v.toLowerCase())}
        error={campos.usuario}
        ayuda="Sin espacios. Ej: carlos.ruiz"
        autoCapitalize="none"
        required
      />
      <div className="fila">
        <CampoTexto
          etiqueta="Cédula"
          valor={conductor.cedula}
          alCambiar={cambiar('cedula')}
          error={campos.cedula}
          inputMode="numeric"
        />
        <CampoTexto
          etiqueta="Teléfono"
          valor={conductor.telefono}
          alCambiar={cambiar('telefono')}
          error={campos.telefono}
          inputMode="tel"
        />
      </div>
      <CampoSeleccion
        etiqueta="Buseta asignada"
        valor={conductor.busetaId}
        alCambiar={cambiar('busetaId')}
        opciones={opcionesBuseta}
        vacio="Sin asignar"
        error={campos.busetaId}
      />

      {!esNuevo && (
        <Interruptor
          etiqueta="Activo (si lo desactivas, no puede entrar)"
          valor={conductor.activo}
          alCambiar={cambiar('activo')}
        />
      )}
      {esNuevo && <p className="ayuda">Al guardar se genera una contraseña que verás una sola vez.</p>}

      <button type="submit" className="boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoSeleccion, CampoTexto, Interruptor } from '../../compartido/ui/Campos.jsx';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

export function FormularioConductor({ inicial, alGuardar }) {
  const [conductor, setConductor] = useState({
    ...inicial,
    cedula: inicial.cedula ?? '',
    telefono: inicial.telefono ?? '',
  });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setConductor((c) => ({ ...c, [campo]: valor }));
  const esNuevo = !inicial.id;

  // Busetas que se le pueden asignar: activas y libres (o la que ya tiene).
  const busetas = useDatos('/busetas').datos?.busetas;
  const opcionesBuseta = (busetas ?? [])
    .filter((b) => b.activo && (!b.conductor || b.conductor.id === inicial.id))
    .map((b) => ({ valor: b.id, texto: `${b.numeroInterno} · ${b.placa}` }));

  async function guardar(evento) {
    evento.preventDefault();
    const { usuario, nombre, cedula, telefono, busetaId, activo } = conductor;
    const cuerpo = { usuario, nombre, cedula, telefono, busetaId };
    const resultado = await enviar(() =>
      esNuevo
        ? api('/conductores', { method: 'POST', cuerpo })
        : api(`/conductores/${inicial.id}`, { method: 'PUT', cuerpo: { ...cuerpo, activo } }),
    );
    if (resultado) alGuardar(resultado);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}

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

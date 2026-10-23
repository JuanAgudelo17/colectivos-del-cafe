import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto, Interruptor } from '../../compartido/ui/Campos.jsx';
import { DOCUMENTOS } from '../../compartido/utilidades/documentos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

export function FormularioBuseta({ inicial, alGuardar }) {
  const [buseta, setBuseta] = useState({
    ...inicial,
    modelo: inicial.modelo ?? '',
    ...Object.fromEntries(DOCUMENTOS.map(({ campo }) => [campo, inicial[campo] ?? ''])),
  });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setBuseta((b) => ({ ...b, [campo]: valor }));
  const esNueva = !inicial.id;

  async function guardar(evento) {
    evento.preventDefault();
    const { numeroInterno, placa, modelo, tieneCupo, valorArriendo, activo } = buseta;
    const fechas = Object.fromEntries(DOCUMENTOS.map(({ campo }) => [campo, buseta[campo]]));
    const cuerpo = { numeroInterno, placa, modelo, tieneCupo, valorArriendo, ...fechas };
    const ok = await enviar(() =>
      esNueva
        ? api('/busetas', { method: 'POST', cuerpo })
        : api(`/busetas/${inicial.id}`, { method: 'PUT', cuerpo: { ...cuerpo, activo } }),
    );
    if (ok) alGuardar();
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}

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
          {DOCUMENTOS.map(({ campo, nombre }) => (
            <CampoTexto
              key={campo}
              etiqueta={nombre}
              type="date"
              valor={buseta[campo]}
              alCambiar={cambiar(campo)}
              error={campos[campo]}
            />
          ))}
        </div>
        <p className="ayuda">Para el extintor, la fecha en que vence la recarga.</p>
      </fieldset>

      {!esNueva && <Interruptor etiqueta="Activa" valor={buseta.activo} alCambiar={cambiar('activo')} />}

      <button type="submit" className="boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

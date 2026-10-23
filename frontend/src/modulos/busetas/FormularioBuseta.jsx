import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto, Interruptor } from '../../compartido/ui/Campos.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

export function FormularioBuseta({ inicial, alGuardar }) {
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
    const { numeroInterno, placa, modelo, tieneCupo, valorArriendo, fechaSoat, fechaTecnomecanica, activo } = buseta;
    const cuerpo = { numeroInterno, placa, modelo, tieneCupo, valorArriendo, fechaSoat, fechaTecnomecanica };
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
      <p className="ayuda">
        {buseta.tieneCupo
          ? 'Con cupo: no paga arriendo y el fondo de reposición es el 1 % del producido.'
          : 'Sin cupo: paga arriendo cada mes y el fondo de reposición es un valor fijo.'}
      </p>
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

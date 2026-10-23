import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos } from '../../compartido/ui/Campos.jsx';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// Tarifas de peajes y salidas por ruta. Solo afectan las propuestas por vueltas;
// los días ya registrados no cambian.
export function TarifasRutas({ rutas, alGuardar }) {
  return (
    <div className="formulario">
      <p className="ayuda">
        Cambiar una tarifa solo afecta lo que se calcule desde ahora con “Vueltas”. Los días ya registrados no cambian.
      </p>
      {rutas.map((r) => (
        <FormularioRuta key={r.id} ruta={r} alGuardar={alGuardar} />
      ))}
    </div>
  );
}

function FormularioRuta({ ruta, alGuardar }) {
  const [datos, setDatos] = useState(ruta);
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const cambiado = ['peajeTrayecto', 'salidaIda', 'salidaRegreso'].some((c) => datos[c] !== ruta[c]);

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() =>
      api(`/producido/rutas/${ruta.id}`, {
        method: 'PUT',
        cuerpo: { peajeTrayecto: datos.peajeTrayecto, salidaIda: datos.salidaIda, salidaRegreso: datos.salidaRegreso },
      }),
    );
    if (r) alGuardar();
  }

  return (
    <form className="tarifa-ruta" onSubmit={guardar} noValidate>
      <h3>{ruta.nombre}</h3>
      {error && <p className="error">{error}</p>}
      <CampoPesos
        etiqueta="Peaje por trayecto"
        ayuda="Una vuelta paga dos peajes"
        valor={datos.peajeTrayecto}
        alCambiar={cambiar('peajeTrayecto')}
        error={campos.peajeTrayecto}
      />
      <div className="fila">
        <CampoPesos etiqueta="Salida de ida" valor={datos.salidaIda} alCambiar={cambiar('salidaIda')} error={campos.salidaIda} />
        <CampoPesos
          etiqueta="Salida de regreso"
          valor={datos.salidaRegreso}
          alCambiar={cambiar('salidaRegreso')}
          error={campos.salidaRegreso}
        />
      </div>
      <button type="submit" className="boton-secundario-oscuro" disabled={!cambiado || enviando}>
        {enviando ? 'Guardando…' : 'Guardar tarifas'}
      </button>
    </form>
  );
}

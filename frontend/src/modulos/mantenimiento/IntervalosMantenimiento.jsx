import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { CampoKilometraje } from './CampoKilometraje.jsx';

// Cada cuánto se hace cada mantenimiento. Solo sirve para proponer el próximo
// al registrar uno; lo ya registrado no cambia.
export function IntervalosMantenimiento() {
  const { datos, error, recargar } = useDatos('/mantenimiento/tipos');

  return (
    <div className="formulario">
      <p className="ayuda">
        Se usan para proponer el próximo cambio al registrar un mantenimiento. Cambiarlos no altera lo ya registrado.
        Vacío = no aplica.
      </p>
      {error && <p className="error">{error}</p>}
      {datos?.tipos
        .filter((t) => t.clave !== 'otro')
        .map((t) => (
          <FormularioIntervalo key={t.clave} tipo={t} alGuardar={recargar} />
        ))}
    </div>
  );
}

function FormularioIntervalo({ tipo, alGuardar }) {
  const [datos, setDatos] = useState({ intervaloKm: tipo.intervaloKm, intervaloMeses: tipo.intervaloMeses ?? '' });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiado = datos.intervaloKm !== tipo.intervaloKm || String(datos.intervaloMeses) !== String(tipo.intervaloMeses ?? '');

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(`/mantenimiento/tipos/${tipo.clave}`, { method: 'PUT', cuerpo: datos }));
    if (r) alGuardar();
  }

  return (
    <form className="tarifa-ruta" onSubmit={guardar} noValidate>
      <h3>{tipo.nombre}</h3>
      {error && <p className="error">{error}</p>}
      <div className="fila">
        <CampoKilometraje
          etiqueta="Cada"
          valor={datos.intervaloKm}
          alCambiar={(v) => setDatos((d) => ({ ...d, intervaloKm: v }))}
          error={campos.intervaloKm}
        />
        <CampoTexto
          etiqueta="O cada (meses)"
          inputMode="numeric"
          valor={datos.intervaloMeses}
          alCambiar={(v) => setDatos((d) => ({ ...d, intervaloMeses: v.replace(/\D/g, '') }))}
          error={campos.intervaloMeses}
        />
      </div>
      <button type="submit" className="boton-secundario-oscuro" disabled={!cambiado || enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

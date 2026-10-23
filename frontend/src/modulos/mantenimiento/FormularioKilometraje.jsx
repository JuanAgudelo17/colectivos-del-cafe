import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoTexto } from '../../compartido/ui/Campos.jsx';
import { fecha as formatoFecha, hoyBogota, kilometros } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { CampoKilometraje } from './CampoKilometraje.jsx';

// Lectura del odómetro. Reportar otra vez el mismo día la corrige.
export function FormularioKilometraje({ busetaId, actual, alGuardar }) {
  const hoy = hoyBogota();
  const [lectura, setLectura] = useState({ fecha: hoy, kilometraje: null });
  const { enviando, error, campos, enviar } = useEnvio();

  async function guardar(evento) {
    evento.preventDefault();
    const hoja = await enviar(() => api(`/mantenimiento/${busetaId}/kilometraje`, { method: 'POST', cuerpo: lectura }));
    if (hoja) alGuardar(hoja);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <CampoKilometraje
        etiqueta="Kilometraje del odómetro"
        valor={lectura.kilometraje}
        alCambiar={(kilometraje) => setLectura((l) => ({ ...l, kilometraje }))}
        error={campos.kilometraje}
        ayuda={actual ? `El último fue ${kilometros(actual.actual)} el ${formatoFecha(actual.fecha)}` : undefined}
        autoFocus
        required
      />
      <CampoTexto
        etiqueta="Fecha"
        type="date"
        max={hoy}
        valor={lectura.fecha}
        alCambiar={(fecha) => setLectura((l) => ({ ...l, fecha }))}
        error={campos.fecha}
      />
      <button type="submit" className="boton-principal" disabled={enviando || lectura.kilometraje == null}>
        {enviando ? 'Guardando…' : 'Guardar kilometraje'}
      </button>
    </form>
  );
}

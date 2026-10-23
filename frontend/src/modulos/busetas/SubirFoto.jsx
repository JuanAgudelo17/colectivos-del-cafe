import { useRef } from 'react';
import { api } from '../../compartido/api.js';
import { comprimirImagen } from '../../compartido/utilidades/imagenes.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// Subir, cambiar o quitar la foto de una buseta (solo el admin).
export function SubirFoto({ buseta, alCambiar }) {
  const entrada = useRef(null);
  const { enviando, error, enviar } = useEnvio();

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = ''; // poder elegir el mismo archivo otra vez
    if (!archivo) return;
    const r = await enviar(async () =>
      api(`/busetas/${buseta.id}/foto`, { method: 'PUT', cuerpo: await comprimirImagen(archivo) }),
    );
    if (r) alCambiar(r.buseta);
  }

  async function quitar() {
    if (!window.confirm('¿Quitar la foto de esta buseta?')) return;
    const r = await enviar(() => api(`/busetas/${buseta.id}/foto`, { method: 'DELETE' }));
    if (r) alCambiar(r.buseta);
  }

  return (
    <div className="subir-foto">
      <input ref={entrada} type="file" accept="image/*" hidden onChange={elegir} />
      <button type="button" className="boton-secundario-oscuro" disabled={enviando} onClick={() => entrada.current.click()}>
        {enviando ? 'Subiendo…' : buseta.foto ? 'Cambiar foto' : 'Subir foto'}
      </button>
      {buseta.foto && (
        <button type="button" className="boton-enlace" disabled={enviando} onClick={quitar}>
          Quitar
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

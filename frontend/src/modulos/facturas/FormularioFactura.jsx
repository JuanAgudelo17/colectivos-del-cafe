import { useRef, useState } from 'react';
import { api } from '../../compartido/api.js';
import { Campo, CampoPesos, CampoSeleccion, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { hoyBogota } from '../../compartido/utilidades/formato.js';
import { comprimirImagen } from '../../compartido/utilidades/imagenes.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { CATEGORIAS } from './categorias.js';

// Registrar una factura: fecha, descripción y precio (lo mínimo) y la foto si
// se tiene (en el celular abre la cámara). La foto se comprime antes de subirla.
// `busetas`: solo para el admin (elige de qué buseta es).
export function FormularioFactura({ busetas = null, busetaInicial = null, alGuardar }) {
  const [datos, setDatos] = useState({
    fecha: hoyBogota(),
    categoria: 'mantenimiento',
    descripcion: '',
    precio: null,
    busetaId: busetaInicial,
  });
  const [foto, setFoto] = useState(null);
  const entrada = useRef(null);
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(async () => {
      const { factura } = await api('/facturas', { method: 'POST', cuerpo: datos });
      if (!foto) return factura;
      // Si la foto falla, la factura ya quedó (no se debe guardar dos veces): se
      // avisa y la foto se agrega desde la lista.
      try {
        return (await api(`/facturas/${factura.id}/foto`, { method: 'PUT', cuerpo: await comprimirImagen(foto) })).factura;
      } catch (err) {
        return { ...factura, errorFoto: `La factura quedó guardada, pero la foto no se pudo subir (${err.message}). Agrégala desde la lista.` };
      }
    });
    if (!r) return;
    if (r.errorFoto) window.alert(r.errorFoto);
    alGuardar(r);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      {busetas && (
        <CampoSeleccion
          etiqueta="Buseta"
          valor={datos.busetaId}
          alCambiar={cambiar('busetaId')}
          error={campos.busetaId}
          vacio="Elige la buseta"
          opciones={busetas.map((b) => ({ valor: b.id, texto: `${b.numeroInterno} · ${b.placa}` }))}
        />
      )}
      <div className="fila">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          max={hoyBogota()}
          valor={datos.fecha}
          alCambiar={cambiar('fecha')}
          error={campos.fecha}
        />
        <Campo etiqueta="Categoría">
          <select value={datos.categoria} onChange={(e) => cambiar('categoria')(e.target.value)}>
            {Object.entries(CATEGORIAS).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <CampoTexto
        etiqueta="Descripción"
        valor={datos.descripcion}
        alCambiar={cambiar('descripcion')}
        error={campos.descripcion}
        placeholder="Ej: pastillas de freno, ACPM La Guaca"
        maxLength={200}
      />
      <CampoPesos etiqueta="Precio" valor={datos.precio} alCambiar={cambiar('precio')} error={campos.precio} />

      <div className="factura-foto">
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
        />
        <button type="button" className="boton-secundario-oscuro" onClick={() => entrada.current.click()}>
          {foto ? 'Cambiar foto' : 'Tomar o elegir foto (opcional)'}
        </button>
        {foto && (
          <span className="detalle">
            📷 {foto.name}{' '}
            <button type="button" className="boton-enlace" onClick={() => setFoto(null)}>
              Quitar
            </button>
          </span>
        )}
      </div>

      <div className="acciones">
        <button type="submit" className="boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar factura'}
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { fecha, hoyBogota, pesos } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// Registrar plata entregada al propietario. Queda liquidada de una vez: cubre
// los peajes pendientes más viejos. Por defecto propone todo lo pendiente.
// `ruta`: '/colpass/mio/entregas' (conductor) o '/colpass/:id/entregas' (admin).
export function FormularioEntrega({ ruta, detalle, alGuardar, alCancelar }) {
  const { pendiente, colpass } = detalle;
  const [datos, setDatos] = useState({ fecha: hoyBogota(), valor: pendiente.total, observacion: '' });
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const parcial = datos.valor > 0 && datos.valor < pendiente.total;

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(ruta, { method: 'POST', cuerpo: datos }));
    if (r) alGuardar(r);
  }

  return (
    <form className="formulario colpass-entrega" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}
      <CampoPesos
        etiqueta="¿Cuánto entregaste?"
        valor={datos.valor}
        alCambiar={cambiar('valor')}
        error={campos.valor}
        ayuda={`Pendiente: ${pesos(pendiente.total)}`}
      />
      <CampoTexto
        etiqueta="Fecha de la entrega"
        type="date"
        min={colpass.desde}
        max={hoyBogota()}
        valor={datos.fecha}
        alCambiar={cambiar('fecha')}
        error={campos.fecha}
      />
      <CampoTexto
        etiqueta="Nota (opcional)"
        valor={datos.observacion}
        alCambiar={cambiar('observacion')}
        error={campos.observacion}
        placeholder="Ej: en efectivo, por Nequi"
        maxLength={200}
      />
      {parcial && (
        <p className="colpass-nota">
          Es una entrega parcial: cubre los peajes más viejos y quedan {pesos(pendiente.total - datos.valor)} pendientes.
        </p>
      )}
      <div className="acciones">
        {alCancelar && (
          <button type="button" className="boton-enlace" onClick={alCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" className="boton-principal" disabled={enviando || !datos.valor || !datos.fecha}>
          {enviando ? 'Guardando…' : `Registrar entrega de ${pesos(datos.valor ?? 0)}`}
        </button>
      </div>
    </form>
  );
}

// Entregas hechas (la más reciente primero), con los días de peajes que cubrió
// cada una. `rutaBorrar(id)` arma la ruta para quitarla (si `puedeBorrar`).
export function ListaEntregas({ entregas, rutaBorrar, alActualizar, quien = 'admin' }) {
  const { enviando, error, enviar } = useEnvio();

  async function quitar(entrega) {
    if (!window.confirm(`¿Quitar la entrega de ${pesos(entrega.valor)}? Esos peajes vuelven a quedar pendientes.`)) return;
    const r = await enviar(() => api(rutaBorrar(entrega.id), { method: 'DELETE' }));
    if (r) alActualizar(r);
  }

  const registradaPor = (e) => {
    if (e.registradaPor === 'admin') return quien === 'admin' ? 'Registrada por el administrador' : 'La registró el administrador';
    return quien === 'admin' ? 'Registrada por el conductor' : 'La registraste tú';
  };

  if (entregas.length === 0) return <p className="vacio">Todavía no hay entregas.</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}
      <ul className="colpass-liquidaciones">
        {entregas.map((e) => (
          <li key={e.id}>
            <strong>{pesos(e.valor)}</strong>
            <span>
              Entregada el {fecha(e.fecha)}
              {e.cubre && ` · cubre peajes del ${fecha(e.cubre.desde)} al ${fecha(e.cubre.hasta)}`}
            </span>
            <small>
              {registradaPor(e)}
              {e.observacion && ` · ${e.observacion}`}
            </small>
            {e.puedeBorrar && (
              <button type="button" className="boton-enlace" disabled={enviando} onClick={() => quitar(e)}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

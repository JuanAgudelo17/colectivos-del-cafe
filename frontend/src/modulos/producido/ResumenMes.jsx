import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { numero } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

const porciento = (v) => `${Math.round(v * 10000) / 100} %`;

// El bloque de abajo de la planilla: bruto, descuentos y neto del mes,
// más los ajustes que se ingresan a mano (bono y préstamos).
export function ResumenMes({ mes, alActualizar }) {
  const { resumen: r, buseta, ajustes } = mes;
  const bonos = ajustes.filter((a) => a.tipo === 'bono');
  const prestamos = ajustes.filter((a) => a.tipo === 'prestamo');

  const lineas = [
    [`Empresa (${porciento(mes.porcentajeEmpresa)})`, r.empresa],
    [`Fondo de reposición (${porciento(mes.porcentajeReposicion)})`, r.reposicion],
    ['Conductor', r.conductor],
    ['Peajes', r.peajes],
    ['Salidas', r.salidas],
    ['ACPM', r.acpm],
    r.mantenimiento > 0 && ['Mantenimiento', r.mantenimiento],
    !buseta.tieneCupo && ['Arriendo', r.arriendo],
    r.diasRelevo > 0 && [`Relevo (${r.diasRelevo} × ${numero(mes.valorRelevo)})`, r.relevo],
  ].filter(Boolean);

  return (
    <aside className="resumen-mes" aria-label="Resumen del mes">
      <div className="resumen-bruto">
        <span>Producido del mes</span>
        <strong>$ {numero(r.bruto)}</strong>
        <small>
          {r.diasTrabajados} {r.diasTrabajados === 1 ? 'día trabajado' : 'días trabajados'}
        </small>
      </div>

      <table className="resumen-tabla">
        <tbody>
          {lineas.map(([texto, valor]) => (
            <tr key={texto}>
              <th scope="row">{texto}</th>
              <td>− {numero(valor)}</td>
            </tr>
          ))}
          {bonos.map((a) => (
            <FilaAjuste key={a.id} ajuste={a} mes={mes} alActualizar={alActualizar} />
          ))}
          {prestamos.map((a) => (
            <FilaAjuste key={a.id} ajuste={a} mes={mes} alActualizar={alActualizar} />
          ))}
        </tbody>
      </table>

      <div className={r.neto < 0 ? 'resumen-neto resumen-neto-negativo' : 'resumen-neto'}>
        <span>Neto</span>
        <strong>$ {numero(r.neto)}</strong>
      </div>

      {!mes.cerrado && <NuevoAjuste mes={mes} alActualizar={alActualizar} />}
    </aside>
  );
}

function FilaAjuste({ ajuste, mes, alActualizar }) {
  const { enviando, enviar } = useEnvio();
  const titulo = ajuste.tipo === 'bono' ? 'Bono' : 'Préstamo';

  async function quitar() {
    if (!window.confirm(`¿Quitar ${titulo.toLowerCase()} de $ ${numero(ajuste.valor)}?`)) return;
    const r = await enviar(() => api(`/producido/${mes.buseta.id}/ajustes/${ajuste.id}`, { method: 'DELETE' }));
    if (r) alActualizar(r);
  }

  return (
    <tr>
      <th scope="row">
        {titulo}
        {ajuste.descripcion && <small> · {ajuste.descripcion}</small>}
        {!mes.cerrado && (
          <button
            type="button"
            className="boton-quitar"
            onClick={quitar}
            disabled={enviando}
            aria-label={`Quitar ${titulo.toLowerCase()}`}
          >
            ✕
          </button>
        )}
      </th>
      <td>− {numero(ajuste.valor)}</td>
    </tr>
  );
}

function NuevoAjuste({ mes, alActualizar }) {
  const [abierto, setAbierto] = useState(null); // 'prestamo' | 'bono' | null
  const [datos, setDatos] = useState({ descripcion: '', valor: null });
  const { enviando, error, campos, enviar } = useEnvio();

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() =>
      api(`/producido/${mes.buseta.id}/ajustes`, {
        method: 'POST',
        cuerpo: { anio: mes.anio, mes: mes.mes, tipo: abierto, ...datos },
      }),
    );
    if (r) {
      alActualizar(r);
      setAbierto(null);
      setDatos({ descripcion: '', valor: null });
    }
  }

  if (!abierto) {
    return (
      <div className="resumen-agregar">
        <button type="button" className="boton-secundario-oscuro" onClick={() => setAbierto('prestamo')}>
          + Préstamo
        </button>
        <button type="button" className="boton-secundario-oscuro" onClick={() => setAbierto('bono')}>
          + Bono (opcional)
        </button>
      </div>
    );
  }

  return (
    <form className="formulario resumen-formulario" onSubmit={guardar} noValidate>
      <strong>{abierto === 'bono' ? 'Agregar bono' : 'Agregar préstamo'}</strong>
      {error && <p className="error">{error}</p>}
      <CampoPesos
        etiqueta="Valor"
        valor={datos.valor}
        alCambiar={(valor) => setDatos((d) => ({ ...d, valor }))}
        error={campos.valor}
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        valor={datos.descripcion}
        alCambiar={(descripcion) => setDatos((d) => ({ ...d, descripcion }))}
        error={campos.descripcion}
        placeholder={abierto === 'bono' ? 'Ej: buen mes' : 'Ej: llantas'}
      />
      <div className="acciones">
        <button type="button" className="boton-enlace" onClick={() => setAbierto(null)}>
          Cancelar
        </button>
        <button type="submit" className="boton-principal" disabled={enviando || !datos.valor}>
          {enviando ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
    </form>
  );
}

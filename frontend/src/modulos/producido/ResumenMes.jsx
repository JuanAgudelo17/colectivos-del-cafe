import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { numero } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

const porciento = (v) => `${Math.round(v * 10000) / 100} %`;

const AJUSTES = {
  prestamo: { titulo: 'Préstamo', boton: '+ Préstamo', ejemplo: 'Ej: llantas' },
  mantenimiento: { titulo: 'Mantenimiento', boton: '+ Mantenimiento', ejemplo: 'Ej: frenos, cambio de aceite' },
  bono: { titulo: 'Bono', boton: '+ Bono (opcional)', ejemplo: 'Ej: buen mes' },
};

// El bloque de abajo de la planilla: bruto, descuentos y neto del mes,
// más los ajustes que se ingresan a mano (préstamos, mantenimiento, bono).
// soloLectura: la versión del conductor (sin agregar ni quitar nada).
export function ResumenMes({ mes, alActualizar, soloLectura = false }) {
  const editable = !soloLectura && !mes.cerrado;
  const { resumen: r, buseta, ajustes } = mes;
  const deTipo = (tipo) => ajustes.filter((a) => a.tipo === tipo);
  const mantenimientoAjustes = deTipo('mantenimiento').reduce((t, a) => t + a.valor, 0);
  const mantenimientoDias = r.mantenimiento - mantenimientoAjustes;

  const lineas = [
    [`Empresa (${porciento(mes.porcentajeEmpresa)})`, r.empresa],
    [
      r.fondoFijo ? 'Fondo de reposición (fijo, paga arriendo)' : `Fondo de reposición (${porciento(mes.porcentajeReposicion)})`,
      r.reposicion,
    ],
    ['Conductor', r.conductor],
    ['Peajes', r.peajes],
    ['Salidas', r.salidas],
    ['ACPM conductor', r.acpmConductor],
    r.acpmCredito > 0 && ['ACPM La Guaca (crédito)', r.acpmCredito],
    mantenimientoDias > 0 && ['Mantenimiento (días)', mantenimientoDias],
    !buseta.tieneCupo && ['Arriendo', r.arriendo],
    r.diasRelevo > 0 && [`Relevo (${r.diasRelevo} × ${numero(mes.valorRelevo)})`, r.relevo],
    r.seguroContractual > 0 && ['Seguro contractual', r.seguroContractual],
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
          {['mantenimiento', 'prestamo', 'bono'].flatMap((tipo) =>
            deTipo(tipo).map((a) => (
              <FilaAjuste key={a.id} ajuste={a} mes={mes} alActualizar={alActualizar} editable={editable} />
            )),
          )}
        </tbody>
      </table>

      <div className={r.neto < 0 ? 'resumen-neto resumen-neto-negativo' : 'resumen-neto'}>
        <span>Neto</span>
        <strong>$ {numero(r.neto)}</strong>
      </div>

      <dl className="resumen-info">
        <div>
          <dt>Antes de ACPM</dt>
          <dd>$ {numero(r.netoAntesAcpm)}</dd>
        </div>
        <div>
          <dt>ACPM total</dt>
          <dd>$ {numero(r.acpm)}</dd>
        </div>
        {r.acpmCredito > 0 && (
          <div className="resumen-info-destacado">
            <dt>Por pagar a La Guaca</dt>
            <dd>$ {numero(r.acpmCredito)}</dd>
          </div>
        )}
      </dl>

      {editable && <NuevoAjuste mes={mes} alActualizar={alActualizar} />}
    </aside>
  );
}

function FilaAjuste({ ajuste, mes, alActualizar, editable }) {
  const { enviando, enviar } = useEnvio();
  const { titulo } = AJUSTES[ajuste.tipo];

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
        {editable && (
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
  const [abierto, setAbierto] = useState(null); // 'prestamo' | 'mantenimiento' | 'bono' | null
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
        {Object.entries(AJUSTES).map(([tipo, { boton }]) => (
          <button key={tipo} type="button" className="boton-secundario-oscuro" onClick={() => setAbierto(tipo)}>
            {boton}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form className="formulario resumen-formulario" onSubmit={guardar} noValidate>
      <strong>Agregar {AJUSTES[abierto].titulo.toLowerCase()}</strong>
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
        placeholder={AJUSTES[abierto].ejemplo}
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

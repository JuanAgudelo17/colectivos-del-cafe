import { api } from '../../compartido/api.js';
import { fecha, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// '2026-09-01T02:10:00Z' → '2026-08-31' (el día en Colombia).
const diaBogota = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// Cerrar el mes con la planilla (lo que da la cuadrícula): queda guardado y ya
// no se edita. Se puede reabrir para corregir algo y volver a cerrarlo.
// Si se cerró con la liquidación de la cooperativa, eso se maneja en su tarjeta.
export function CierreMes({ mes, alActualizar }) {
  const { enviando, error, enviar } = useEnvio();
  const base = `/producido/${mes.buseta.id}/cierre`;

  async function cerrar() {
    const texto =
      `¿Cerrar ${nombreMes(mes.anio, mes.mes)} de la ${mes.buseta.numeroInterno}?\n\n` +
      `Producido ${pesos(mes.resumen.bruto)} · Total neto ${pesos(mes.resumen.neto)}\n\n` +
      'Queda guardado así y ya no se pueden cambiar los días, préstamos ni bonos (salvo que lo reabras).';
    if (!window.confirm(texto)) return;
    const r = await enviar(() => api(base, { method: 'POST', cuerpo: { anio: mes.anio, mes: mes.mes } }));
    if (r) alActualizar(r);
  }

  async function reabrir() {
    if (!window.confirm('¿Reabrir el mes? Se podrá editar otra vez y habrá que volver a cerrarlo.')) return;
    const r = await enviar(() => api(`${base}?anio=${mes.anio}&mes=${mes.mes}`, { method: 'DELETE' }));
    if (r) alActualizar(r);
  }

  if (mes.cierre?.origen === 'calculado') {
    return (
      <div className="cierre-mes">
        <span className="cierre-mes-estado">
          ✓ Mes cerrado{mes.cierre.cerradoEn && ` el ${fecha(diaBogota(mes.cierre.cerradoEn))}`}
        </span>
        <button type="button" className="boton-enlace" disabled={enviando} onClick={reabrir}>
          Reabrir el mes
        </button>
        {error && <span className="error">{error}</span>}
      </div>
    );
  }

  if (mes.cerrado) return null;

  const sinProducido = mes.resumen.bruto === 0;
  return (
    <div className="cierre-mes">
      <button
        type="button"
        className="boton-principal"
        disabled={enviando || !mes.mesTerminado || sinProducido}
        onClick={cerrar}
      >
        {enviando ? 'Cerrando…' : 'Cerrar el mes'}
      </button>
      {!mes.mesTerminado && <span className="detalle">Se puede cerrar cuando termine el mes.</span>}
      {mes.mesTerminado && sinProducido && <span className="detalle">No hay producido para cerrar.</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// Botón para avisarle al conductor que ya está cargado su producido del mes:
// le llega a la campanita y al celular (si activó las notificaciones).
export function AvisarConductor({ mes }) {
  const [enviado, setEnviado] = useState(null);
  const { enviando, error, enviar } = useEnvio();
  const conductor = mes.buseta.conductor;
  if (!conductor) return null;

  const primerNombre = conductor.nombre.split(' ')[0];
  const sinProducido = mes.resumen.bruto === 0;

  async function avisar() {
    setEnviado(null);
    const r = await enviar(() =>
      api(`/producido/${mes.buseta.id}/avisar`, { method: 'POST', cuerpo: { anio: mes.anio, mes: mes.mes } }),
    );
    if (r) setEnviado(r);
  }

  return (
    <div className="producido-avisar">
      <button
        type="button"
        className="boton-secundario-oscuro"
        disabled={enviando || sinProducido}
        onClick={avisar}
        title={sinProducido ? 'Todavía no hay producido en este mes' : undefined}
      >
        {enviando ? 'Avisando…' : `Avisarle a ${primerNombre}`}
      </button>
      {enviado && (
        <span className="ok" role="status">
          ✓ Le avisamos a {primerNombre}
          {enviado.enviadas > 0 ? ' (también al celular)' : ' (en su campanita)'}
        </span>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

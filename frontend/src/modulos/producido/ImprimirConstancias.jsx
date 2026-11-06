import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { nombreMes } from '../../compartido/utilidades/formato.js';

// Constancias de verificación del mes (los papelitos de las planillas) en PDF
// para imprimir y recortar: de toda la flota o de las busetas que se elijan.
// Cada buseta empieza en hoja nueva. La librería del PDF se carga al generar.
export function ImprimirConstancias({ busetas, periodo }) {
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  function abrir() {
    setElegidas(busetas.map((b) => b.id));
    setError(null);
    setAbierto(true);
  }

  const cambiar = (id, marcada) => setElegidas((lista) => (marcada ? [...lista, id] : lista.filter((x) => x !== id)));

  async function generar() {
    setGenerando(true);
    setError(null);
    try {
      const [{ exportarConstancias }, ...meses] = await Promise.all([
        import('./constancias.js'),
        // En el orden de la lista (por número interno).
        ...busetas
          .filter((b) => elegidas.includes(b.id))
          .map((b) => api(`/producido?busetaId=${b.id}&anio=${periodo.anio}&mes=${periodo.mes}`)),
      ]);
      exportarConstancias(meses);
      setAbierto(false);
    } catch (err) {
      setError(err.message || 'No se pudieron generar las constancias. Inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  const todas = elegidas.length === busetas.length;

  return (
    <>
      <button
        type="button"
        className="boton-secundario-oscuro"
        disabled={!busetas?.length}
        onClick={abrir}
        title="Los papelitos de cada día para pegar en las planillas"
      >
        Constancias para imprimir
      </button>

      <Dialogo abierto={abierto} titulo="Constancias para imprimir" alCerrar={() => setAbierto(false)}>
        <div className="formulario">
          <p className="ayuda">
            Una constancia por cada día de {nombreMes(periodo.anio, periodo.mes)}, 12 por hoja carta. Los días ya
            registrados salen con sus valores; los demás, en blanco para llenar a mano.
          </p>
          {error && <p className="error">{error}</p>}

          <fieldset className="constancias-busetas">
            <legend>Busetas</legend>
            <label className="constancias-casilla constancias-todas">
              <input
                type="checkbox"
                checked={todas}
                onChange={(e) => setElegidas(e.target.checked ? busetas.map((b) => b.id) : [])}
              />
              Toda la flota ({busetas.length})
            </label>
            {busetas.map((b) => (
              <label key={b.id} className="constancias-casilla">
                <input type="checkbox" checked={elegidas.includes(b.id)} onChange={(e) => cambiar(b.id, e.target.checked)} />
                {b.numeroInterno} · {b.placa}
              </label>
            ))}
          </fieldset>

          <div className="acciones">
            <button type="button" className="boton-enlace" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="boton-principal" disabled={generando || elegidas.length === 0} onClick={generar}>
              {generando
                ? 'Generando…'
                : elegidas.length === 1
                  ? 'Generar PDF (1 buseta)'
                  : `Generar PDF (${elegidas.length} busetas)`}
            </button>
          </div>
        </div>
      </Dialogo>
    </>
  );
}

import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { Campo, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { hoyBogota } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { CampoKilometraje } from './CampoKilometraje.jsx';
import { ACOMPANANTES, proponerProximo } from './proximo.js';

// Registrar (o corregir) un mantenimiento. El próximo cambio se propone con el
// intervalo del tipo hasta que la persona lo cambie a mano.
// `inicial`: un registro existente (editar) o { tipo } para uno nuevo.
export function FormularioMantenimiento({ busetaId, tipos, kmActual, inicial, alGuardar }) {
  const hoy = hoyBogota();
  const esNuevo = !inicial.id;
  const tipoDe = (clave) => tipos.find((t) => t.clave === clave);
  const opciones = tipos.filter((t) => t.activo || t.clave === inicial.tipo);

  const [registro, setRegistro] = useState(() => {
    const base = {
      tipo: inicial.tipo ?? opciones[0]?.clave,
      fecha: inicial.fecha ?? hoy,
      kilometraje: esNuevo ? (kmActual ?? null) : inicial.kilometraje,
      observacion: inicial.observacion ?? '',
    };
    const proximo = esNuevo
      ? proponerProximo(tipoDe(base.tipo), base.fecha, base.kilometraje)
      : { proximoKm: inicial.proximoKm, proximaFecha: inicial.proximaFecha ?? '' };
    return { ...base, ...proximo };
  });
  // Al editar, los próximos guardados se respetan: no se recalculan solos.
  const [proximoAMano, setProximoAMano] = useState(!esNuevo);
  const [tambien, setTambien] = useState([]);
  const { enviando, error, campos, enviar } = useEnvio();

  // Cambiar tipo, fecha o km vuelve a proponer el próximo (si no se tocó a mano).
  function cambiar(campo, valor) {
    setRegistro((r) => {
      const nuevo = { ...r, [campo]: valor };
      if (proximoAMano || !['tipo', 'fecha', 'kilometraje'].includes(campo)) return nuevo;
      return { ...nuevo, ...proponerProximo(tipoDe(nuevo.tipo), nuevo.fecha, nuevo.kilometraje) };
    });
    if (campo === 'tipo') setTambien([]);
  }

  function cambiarProximo(campo, valor) {
    setProximoAMano(true);
    setRegistro((r) => ({ ...r, [campo]: valor }));
  }

  const acompanantes = esNuevo ? (ACOMPANANTES[registro.tipo] ?? []).map(tipoDe).filter((t) => t?.activo) : [];

  async function guardar(evento) {
    evento.preventDefault();
    const { tipo, fecha, kilometraje, observacion, proximoKm, proximaFecha } = registro;
    const hoja = await enviar(() =>
      esNuevo
        ? api(`/mantenimiento/${busetaId}/registros`, {
            method: 'POST',
            cuerpo: {
              fecha,
              kilometraje,
              observacion,
              items: [
                { tipo, proximoKm, proximaFecha },
                // Cada acompañante con el próximo que le toca según su propio intervalo.
                ...tambien.map((clave) => ({ tipo: clave, ...proponerProximo(tipoDe(clave), fecha, kilometraje) })),
              ],
            },
          })
        : api(`/mantenimiento/${busetaId}/registros/${inicial.id}`, {
            method: 'PUT',
            cuerpo: { tipo, fecha, kilometraje, observacion, proximoKm, proximaFecha },
          }),
    );
    if (hoja) alGuardar(hoja);
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {error && <p className="error">{error}</p>}

      <Campo etiqueta="Qué se hizo" error={campos.tipo ?? campos.items}>
        <select value={registro.tipo} onChange={(e) => cambiar('tipo', e.target.value)}>
          {opciones.map((t) => (
            <option key={t.clave} value={t.clave}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>

      {acompanantes.length > 0 && (
        <fieldset className="mantenimiento-tambien">
          <legend>También cambié</legend>
          {acompanantes.map((t) => (
            <label key={t.clave} className="casilla">
              <input
                type="checkbox"
                checked={tambien.includes(t.clave)}
                onChange={(e) =>
                  setTambien((lista) => (e.target.checked ? [...lista, t.clave] : lista.filter((c) => c !== t.clave)))
                }
              />
              {t.nombre}
            </label>
          ))}
        </fieldset>
      )}

      <div className="fila">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          max={hoy}
          valor={registro.fecha}
          alCambiar={(v) => cambiar('fecha', v)}
          error={campos.fecha}
        />
        <CampoKilometraje
          etiqueta="Kilometraje"
          valor={registro.kilometraje}
          alCambiar={(v) => cambiar('kilometraje', v)}
          error={campos.kilometraje}
          ayuda="Lo que marcaba el odómetro"
        />
      </div>

      <fieldset>
        <legend>Próximo cambio</legend>
        <div className="fila">
          <CampoKilometraje
            etiqueta="A los"
            valor={registro.proximoKm}
            alCambiar={(v) => cambiarProximo('proximoKm', v)}
            error={campos.proximoKm ?? campos['items.0.proximoKm']}
          />
          <CampoTexto
            etiqueta="O antes del"
            type="date"
            valor={registro.proximaFecha}
            alCambiar={(v) => cambiarProximo('proximaFecha', v)}
            error={campos.proximaFecha ?? campos['items.0.proximaFecha']}
          />
        </div>
        <p className="ayuda">
          {proximoAMano
            ? 'Toca lo que llegue primero: el kilometraje o la fecha.'
            : 'Propuesto según cada cuánto se hace. Puedes cambiarlo.'}
        </p>
      </fieldset>

      <CampoTexto
        etiqueta="Observación (opcional)"
        valor={registro.observacion}
        alCambiar={(v) => cambiar('observacion', v)}
        error={campos.observacion}
        placeholder="Taller, marca del aceite, repuestos…"
        maxLength={300}
      />

      <button type="submit" className="boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

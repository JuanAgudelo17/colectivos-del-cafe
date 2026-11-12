import { useRef, useState } from 'react';
import { api } from '../../compartido/api.js';
import { Campo, CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { diasDelMes, hoyBogota, numero, pesos } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';

// Cada ruta da dos trayectos: ida (de la primera ciudad a la segunda) y regreso.
// Proponen el peaje y la salida de las tarifas; se pueden corregir.
function trayectosDe(rutas) {
  return rutas
    .filter((r) => r.activo)
    .flatMap((r) => {
      const [a, b = ''] = r.nombre.split(/\s*[–-]\s*/);
      return [
        { clave: `${r.id}-ida`, rutaId: r.id, sentido: 'ida', texto: `${a} → ${b}`, peaje: r.peajeTrayecto, salida: r.salidaIda },
        { clave: `${r.id}-regreso`, rutaId: r.id, sentido: 'regreso', texto: `${b} → ${a}`, peaje: r.peajeTrayecto, salida: r.salidaRegreso },
      ];
    });
}

const vueltas = (n) => {
  if (n === 1) return 'media vuelta';
  const enteras = Math.floor(n / 2);
  const texto = enteras === 1 ? '1 vuelta' : `${enteras} vueltas`;
  return n % 2 ? `${texto} y media` : texto;
};

// Digitar las planillas de despacho una por una: fecha, trayecto y valor (el
// consecutivo es opcional y evita digitar dos veces la misma). La app suma sola:
// cada día de la cuadrícula toma de sus planillas el producido, los peajes y las
// salidas. Al agregar una, el trayecto pasa solo al sentido contrario (una vuelta
// son dos planillas) y el cursor vuelve al valor para seguir con la siguiente.
export function DigitarPlanillas({ mes, rutas, alActualizar }) {
  const trayectos = trayectosDe(rutas);
  const consulta = useDatos(`/producido/${mes.buseta.id}/planillas?anio=${mes.anio}&mes=${mes.mes}`);
  const [propias, setPropias] = useState(null); // lo que devuelve cada guardado
  const planillas = propias ?? consulta.datos?.planillas ?? [];

  const dias = diasDelMes(mes.anio, mes.mes);
  const hoy = hoyBogota();
  const ultimo = dias.at(-1).fecha;
  const [datos, setDatos] = useState(() => {
    const t = trayectos[0];
    return {
      fecha: hoy < ultimo ? (hoy >= dias[0].fecha ? hoy : dias[0].fecha) : ultimo,
      trayecto: t?.clave ?? '',
      valor: null,
      consecutivo: '',
      peaje: t?.peaje ?? 0,
      salida: t?.salida ?? 0,
    };
  });
  const [listo, setListo] = useState(null);
  const valorRef = useRef(null);
  const { enviando, error, campos, enviar } = useEnvio();
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  function elegirTrayecto(clave) {
    const t = trayectos.find((x) => x.clave === clave);
    setDatos((d) => ({ ...d, trayecto: clave, peaje: t?.peaje ?? 0, salida: t?.salida ?? 0 }));
  }

  async function agregar(e) {
    e.preventDefault();
    const t = trayectos.find((x) => x.clave === datos.trayecto);
    const r = await enviar(() =>
      api(`/producido/${mes.buseta.id}/planillas`, {
        method: 'POST',
        cuerpo: {
          fecha: datos.fecha,
          rutaId: t?.rutaId ?? null,
          sentido: t?.sentido ?? 'ida',
          consecutivo: datos.consecutivo,
          valor: datos.valor,
          peaje: datos.peaje,
          salida: datos.salida,
        },
      }),
    );
    if (!r) return;
    setPropias(r.planillas);
    alActualizar(r.mes);
    setListo(`✓ Planilla de ${pesos(datos.valor)} sumada al día ${Number(datos.fecha.slice(8))}.`);
    // La siguiente suele ser el regreso (o la ida de la vuelta que sigue).
    const contrario = t && trayectos.find((x) => x.rutaId === t.rutaId && x.sentido !== t.sentido);
    if (contrario) elegirTrayecto(contrario.clave);
    setDatos((d) => ({ ...d, valor: null, consecutivo: '' }));
    valorRef.current?.focus();
  }

  async function quitar(p) {
    if (!window.confirm(`¿Quitar la planilla de ${pesos(p.valor)} del día ${Number(p.fecha.slice(8))}?`)) return;
    const r = await enviar(() => api(`/producido/${mes.buseta.id}/planillas/${p.id}`, { method: 'DELETE' }));
    if (!r) return;
    setPropias(r.planillas);
    alActualizar(r.mes);
    setListo(null);
  }

  // Días con planillas, el más reciente primero.
  const grupos = {};
  for (const p of planillas) (grupos[p.fecha] ??= []).push(p);
  const porDia = Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
  const semana = Object.fromEntries(dias.map((d) => [d.fecha, d.semana]));
  const textoTrayecto = (p) =>
    trayectos.find((t) => t.rutaId === p.rutaId && t.sentido === p.sentido)?.texto ?? p.ruta ?? 'Sin ruta';
  const suma = (lista, campo) => lista.reduce((t, p) => t + p[campo], 0);

  return (
    <div className="planillas">
      <form className="formulario planillas-formulario" onSubmit={agregar} noValidate>
        <p className="ayuda">
          Cada día toma de sus planillas el producido, los peajes y las salidas de la cuadrícula. El ACPM, el relevo y lo
          demás no cambian.
        </p>
        {error && !Object.keys(campos).length && <p className="error">{error}</p>}
        <div className="fila">
          <CampoTexto
            etiqueta="Fecha"
            type="date"
            min={dias[0].fecha}
            max={hoy < ultimo ? hoy : ultimo}
            valor={datos.fecha}
            alCambiar={cambiar('fecha')}
            error={campos.fecha}
          />
          <Campo etiqueta="Trayecto">
            <select value={datos.trayecto} onChange={(e) => elegirTrayecto(e.target.value)}>
              {trayectos.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="fila">
          <CampoPesos
            ref={valorRef}
            etiqueta="Valor de la planilla"
            valor={datos.valor}
            alCambiar={cambiar('valor')}
            error={campos.valor}
            autoFocus
          />
          <CampoTexto
            etiqueta="Consecutivo (opcional)"
            inputMode="numeric"
            valor={datos.consecutivo}
            alCambiar={cambiar('consecutivo')}
            error={campos.consecutivo}
            placeholder="Ej: 366926"
            maxLength={30}
          />
        </div>
        <div className="fila">
          <CampoPesos etiqueta="Peaje (al conductor)" valor={datos.peaje} alCambiar={cambiar('peaje')} error={campos.peaje} />
          <CampoPesos etiqueta="Salida" valor={datos.salida} alCambiar={cambiar('salida')} error={campos.salida} />
        </div>
        <div className="acciones">
          <button type="submit" className="boton-principal" disabled={enviando}>
            {enviando ? 'Sumando…' : 'Agregar planilla'}
          </button>
        </div>
        {listo && (
          <p className="ok" role="status">
            {listo}
          </p>
        )}
      </form>

      <section className="planillas-lista" aria-label="Planillas del mes">
        {consulta.cargando && !consulta.datos && !propias && <p className="vacio">Cargando…</p>}
        {consulta.datos && planillas.length === 0 && <p className="vacio">Todavía no hay planillas en este mes.</p>}
        {porDia.map(([fecha, lista]) => (
          <div key={fecha} className="planillas-dia">
            <div className="planillas-dia-cabeza">
              <strong>
                {semana[fecha]} {Number(fecha.slice(8))}
              </strong>
              <span>
                {lista.length} {lista.length === 1 ? 'planilla' : 'planillas'} · {vueltas(lista.length)}
              </span>
              <strong className="planillas-dia-total">{pesos(suma(lista, 'valor'))}</strong>
              <small>
                Peajes {numero(suma(lista, 'peaje'))} · Salidas {numero(suma(lista, 'salida'))}
              </small>
            </div>
            <ul>
              {lista.map((p) => (
                <li key={p.id}>
                  <span>
                    {textoTrayecto(p)}
                    {p.consecutivo && <small> · N.º {p.consecutivo}</small>}
                  </span>
                  <span className="numero">{numero(p.valor)}</span>
                  <button type="button" className="boton-enlace" disabled={enviando} onClick={() => quitar(p)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

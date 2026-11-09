import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { hoyBogota, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { NOMINA, OPERATIVOS, netoCalculado } from './liquidacion.js';

const VACIA = Object.fromEntries([...OPERATIVOS, ...NOMINA].map(([clave]) => [clave, null]));
const delTexto = (anioMes) => nombreMes(Number(anioMes.slice(0, 4)), Number(anioMes.slice(5, 7)));

// Digitar la liquidación mensual de la cooperativa (el documento que llega cada
// mes), o cargarla desde su PDF (se lee en el navegador y llena los campos, que
// se pueden corregir). Al guardar, el mes queda cerrado con esos valores. El neto
// a pagar del documento tiene que cuadrar con la cuenta: así se detectan errores.
// Aparte va el combustible de La Guaca (no es de la cooperativa, lo paga el dueño):
// se digita o se carga de la cuenta de cobro, y se descuenta para el producido neto.
export function FormularioLiquidacion({ mes, alGuardar }) {
  // Si todavía no se ha cargado, se propone lo de La Guaca de la cuadrícula del mes.
  const guacaDeLosDias = mes.dias.reduce((t, d) => t + Number(d.acpmCredito ?? 0), 0);
  const [datos, setDatos] = useState(() => ({
    fecha: hoyBogota(),
    totalBruto: null,
    netoAPagar: null,
    ...VACIA,
    combustibleLaGuaca: guacaDeLosDias || null,
    ...(mes.liquidacion ?? {}),
  }));
  const [guaca, setGuaca] = useState(() =>
    mes.liquidacion?.combustibleLaGuaca == null && guacaDeLosDias > 0 ? { deLosDias: true } : null,
  ); // { deLosDias } | { tanqueadas, total, avisos } | { error }
  const [leyendoGuaca, setLeyendoGuaca] = useState(false);
  const { enviando, error, campos, enviar } = useEnvio();
  const [lectura, setLectura] = useState(null); // { leidos, avisos } | { error }
  const [leyendo, setLeyendo] = useState(false);

  async function cargarPdf(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // para poder volver a elegir el mismo archivo
    if (!archivo) return;
    setLeyendo(true);
    setLectura(null);
    try {
      const { leerLiquidacionPdf } = await import('./leerLiquidacion.js');
      const r = await leerLiquidacionPdf(archivo);
      if (r.leidos === 0) {
        setLectura({ error: 'No se encontró la liquidación en ese PDF. ¿Es el documento de la cooperativa?' });
        return;
      }
      setDatos((d) => ({ ...d, ...VACIA, ...r.valores }));
      const avisos = [];
      if (r.periodo && (r.periodo.anio !== mes.anio || r.periodo.mes !== mes.mes)) {
        avisos.push(`El PDF es de ${nombreMes(r.periodo.anio, r.periodo.mes)} y estás en ${nombreMes(mes.anio, mes.mes)}.`);
      }
      const sinGuion = (t) => t.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (r.micro && r.micro !== mes.buseta.numeroInterno) {
        avisos.push(`El PDF es del micro ${r.micro} y estás en la ${mes.buseta.numeroInterno}.`);
      } else if (r.placa && sinGuion(r.placa) !== sinGuion(mes.buseta.placa)) {
        avisos.push(`El PDF es de la placa ${r.placa} y esta buseta es ${mes.buseta.placa}.`);
      }
      setLectura({ leidos: r.leidos, avisos });
    } catch (err) {
      console.error('No se pudo leer el PDF de la liquidación', err);
      setLectura({ error: 'No se pudo leer el PDF. Digita los valores a mano.' });
    } finally {
      setLeyendo(false);
    }
  }

  async function cargarCuentaGuaca(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendoGuaca(true);
    setGuaca(null);
    try {
      const { combustibleDelMes, leerCuentaGuacaPdf } = await import('./leerCuentaGuaca.js');
      const cuenta = await leerCuentaGuacaPdf(archivo);
      if (cuenta.tanqueadas.length === 0) {
        setGuaca({ error: 'No se encontraron tanqueadas en ese PDF. ¿Es la cuenta de cobro de La Guaca?' });
        return;
      }
      const { placa, numeroInterno } = mes.buseta;
      const c = combustibleDelMes(cuenta, { placa, anio: mes.anio, mes: mes.mes });
      if (c.tanqueadas === 0) {
        setGuaca({
          error:
            c.otrosMeses.length > 0
              ? `Las tanqueadas de la ${placa} en esa cuenta son de ${c.otrosMeses.map(delTexto).join(' y ')}, y estás en ${nombreMes(mes.anio, mes.mes)}.`
              : `La cuenta es de ${c.otrasPlacas.length === 1 ? 'la placa' : 'las placas'} ${c.otrasPlacas.join(', ')} y la ${numeroInterno} es ${placa}.`,
        });
        return;
      }
      setDatos((d) => ({ ...d, combustibleLaGuaca: c.total }));
      const avisos = [];
      if (c.otrasPlacas.length > 0) avisos.push(`La cuenta trae también tanqueadas de ${c.otrasPlacas.join(', ')}: no se sumaron.`);
      if (c.otrosMeses.length > 0) avisos.push(`Hay tanqueadas de ${c.otrosMeses.map(delTexto).join(' y ')}: no se sumaron.`);
      if (!c.cuadra) avisos.push(`Las filas suman ${pesos(c.sumaTodas)} y la cuenta dice ${pesos(c.valorAPagar)}. Revísala.`);
      setGuaca({ tanqueadas: c.tanqueadas, total: c.total, avisos });
    } catch (err) {
      console.error('No se pudo leer la cuenta de La Guaca', err);
      setGuaca({ error: 'No se pudo leer el PDF. Digita el valor a mano.' });
    } finally {
      setLeyendoGuaca(false);
    }
  }

  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const calculado = netoCalculado(datos);
  const netoFinal = (datos.netoAPagar ?? 0) - (datos.combustibleLaGuaca ?? 0);
  const cuadra = datos.netoAPagar != null && datos.totalBruto != null && calculado === datos.netoAPagar;

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() =>
      api(`/producido/${mes.buseta.id}/liquidacion`, {
        method: 'PUT',
        cuerpo: { ...datos, anio: mes.anio, mes: mes.mes },
      }),
    );
    if (r) alGuardar(r);
  }

  const grupo = (titulo, lista) => (
    <fieldset className="liquidacion-campos">
      <legend>{titulo}</legend>
      {lista.map(([clave, nombre]) => (
        <CampoPesos key={clave} etiqueta={nombre} valor={datos[clave]} alCambiar={cambiar(clave)} error={campos[clave]} />
      ))}
    </fieldset>
  );

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <p className="ayuda">
        {mes.buseta.numeroInterno} · {nombreMes(mes.anio, mes.mes)}. Copia los valores del documento; los vacíos
        quedan en $ 0.
      </p>
      <div className="liquidacion-pdf">
        <label className={leyendo ? 'boton-secundario-oscuro deshabilitado' : 'boton-secundario-oscuro'}>
          <input type="file" accept="application/pdf,.pdf" className="sr" onChange={cargarPdf} disabled={leyendo} />
          {leyendo ? 'Leyendo el PDF…' : 'Cargar desde el PDF'}
        </label>
        <span className="detalle">o digita los valores a mano.</span>
      </div>
      {lectura?.error && <p className="error">{lectura.error}</p>}
      {lectura?.leidos > 0 && (
        <p className="ok" role="status">
          ✓ Se leyeron {lectura.leidos} valores del PDF. Revisa que coincidan con el documento y guarda.
        </p>
      )}
      {lectura?.avisos?.map((a) => (
        <p key={a} className="aviso">
          ⚠️ {a}
        </p>
      ))}
      {mes.cierre?.origen === 'calculado' && (
        <p className="aviso">
          Este mes ya está cerrado con la planilla. La liquidación lo reemplaza (manda) y abajo de ella vas a ver
          la comparación con la planilla.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="liquidacion-cabeza">
        <CampoPesos etiqueta="Total bruto" valor={datos.totalBruto} alCambiar={cambiar('totalBruto')} error={campos.totalBruto} />
        <CampoTexto
          etiqueta="Fecha de la liquidación"
          type="date"
          valor={datos.fecha ?? ''}
          alCambiar={cambiar('fecha')}
          error={campos.fecha}
        />
      </div>
      {grupo('Descuentos operativos', OPERATIVOS)}
      {grupo('Descuentos de nómina', NOMINA)}
      <CampoPesos
        etiqueta="Neto a pagar (del documento)"
        valor={datos.netoAPagar}
        alCambiar={cambiar('netoAPagar')}
        error={campos.netoAPagar}
        ayuda={
          datos.totalBruto == null
            ? undefined
            : cuadra
              ? '✓ Cuadra con los valores'
              : `Con estos valores da ${pesos(calculado)}`
        }
      />

      <fieldset className="liquidacion-campos liquidacion-guaca">
        <legend>Combustible La Guaca</legend>
        <p className="detalle">
          No va en la liquidación de la cooperativa: es el ACPM a crédito que el dueño le paga a La Guaca con su
          cuenta de cobro. Se descuenta del neto a pagar.
        </p>
        <div className="liquidacion-pdf">
          <label className={leyendoGuaca ? 'boton-secundario-oscuro deshabilitado' : 'boton-secundario-oscuro'}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr"
              onChange={cargarCuentaGuaca}
              disabled={leyendoGuaca}
            />
            {leyendoGuaca ? 'Leyendo la cuenta…' : 'Cargar la cuenta de La Guaca (PDF)'}
          </label>
        </div>
        {guaca?.error && <p className="error">{guaca.error}</p>}
        {guaca?.tanqueadas > 0 && (
          <p className="ok" role="status">
            ✓ {guaca.tanqueadas} {guaca.tanqueadas === 1 ? 'tanqueada' : 'tanqueadas'} de la {mes.buseta.placa} en{' '}
            {nombreMes(mes.anio, mes.mes)}: {pesos(guaca.total)}.
          </p>
        )}
        {guaca?.avisos?.map((a) => (
          <p key={a} className="aviso">
            ⚠️ {a}
          </p>
        ))}
        <CampoPesos
          etiqueta="Combustible La Guaca del mes"
          valor={datos.combustibleLaGuaca}
          alCambiar={(v) => {
            cambiar('combustibleLaGuaca')(v);
            if (guaca?.deLosDias) setGuaca(null);
          }}
          error={campos.combustibleLaGuaca}
          ayuda={guaca?.deLosDias ? 'Es lo de La Guaca en la cuadrícula del mes. Corrígelo con la cuenta de cobro.' : undefined}
        />
      </fieldset>

      {datos.netoAPagar != null && (
        <div className="liquidacion-neto-final">
          <span>Producido neto</span>
          <strong>{pesos(netoFinal)}</strong>
          <small>
            Neto a pagar {pesos(datos.netoAPagar)} − La Guaca {pesos(datos.combustibleLaGuaca ?? 0)}
          </small>
        </div>
      )}
      <div className="acciones">
        <button type="submit" className="boton-principal" disabled={enviando || !cuadra}>
          {enviando ? 'Guardando…' : 'Cerrar el mes con esta liquidación'}
        </button>
      </div>
    </form>
  );
}

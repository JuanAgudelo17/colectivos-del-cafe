import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { hoyBogota, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { NOMINA, OPERATIVOS, netoCalculado } from './liquidacion.js';

const VACIA = Object.fromEntries([...OPERATIVOS, ...NOMINA].map(([clave]) => [clave, null]));

// Digitar la liquidación mensual de la cooperativa (el documento que llega cada
// mes), o cargarla desde su PDF (se lee en el navegador y llena los campos, que
// se pueden corregir). Al guardar, el mes queda cerrado con esos valores. El neto
// a pagar del documento tiene que cuadrar con la cuenta: así se detectan errores.
export function FormularioLiquidacion({ mes, alGuardar }) {
  const [datos, setDatos] = useState(() => ({
    fecha: hoyBogota(),
    totalBruto: null,
    netoAPagar: null,
    ...VACIA,
    ...(mes.liquidacion ?? {}),
  }));
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
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const calculado = netoCalculado(datos);
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
      <div className="acciones">
        <button type="submit" className="boton-principal" disabled={enviando || !cuadra}>
          {enviando ? 'Guardando…' : 'Cerrar el mes con esta liquidación'}
        </button>
      </div>
    </form>
  );
}

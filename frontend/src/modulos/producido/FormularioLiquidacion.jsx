import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoPesos, CampoTexto } from '../../compartido/ui/Campos.jsx';
import { hoyBogota, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import { NOMINA, OPERATIVOS, netoCalculado } from './liquidacion.js';

const VACIA = Object.fromEntries([...OPERATIVOS, ...NOMINA].map(([clave]) => [clave, null]));

// Digitar la liquidación mensual de la cooperativa (el documento que llega cada
// mes). Al guardar, el mes queda cerrado con esos valores. El neto a pagar del
// documento tiene que cuadrar con la cuenta: así se detectan errores al digitar.
export function FormularioLiquidacion({ mes, alGuardar }) {
  const [datos, setDatos] = useState(() => ({
    fecha: hoyBogota(),
    totalBruto: null,
    netoAPagar: null,
    ...VACIA,
    ...(mes.liquidacion ?? {}),
  }));
  const { enviando, error, campos, enviar } = useEnvio();
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

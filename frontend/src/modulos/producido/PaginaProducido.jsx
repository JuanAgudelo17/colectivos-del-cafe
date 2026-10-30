import { useState } from 'react';
import { api } from '../../compartido/api.js';
import { CampoSeleccion } from '../../compartido/ui/Campos.jsx';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { SelectorMes } from '../../compartido/ui/SelectorMes.jsx';
import { mesActual, nombreMes } from '../../compartido/utilidades/formato.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { SeccionColpass } from '../colpass/index.js';
import { AvisarConductor } from './AvisarConductor.jsx';
import { CalculoVueltas } from './CalculoVueltas.jsx';
import { CierreMes } from './CierreMes.jsx';
import { Conciliacion } from './Conciliacion.jsx';
import { CuadriculaMes } from './CuadriculaMes.jsx';
import { DescargarPdf } from './DescargarPdf.jsx';
import { FormularioLiquidacion } from './FormularioLiquidacion.jsx';
import { LiquidacionCooperativa } from './LiquidacionCooperativa.jsx';
import { PegarExcel } from './PegarExcel.jsx';
import { ResumenMes } from './ResumenMes.jsx';
import { TarifasRutas } from './TarifasRutas.jsx';
import './producido.css';

// Registro del producido: el admin elige buseta y mes, digita cada día en la
// cuadrícula (o pega la planilla de Excel) y ve el resumen del mes al lado.
export function PaginaProducido() {
  const busetas = useDatos('/busetas').datos?.busetas.filter((b) => b.activo);
  const rutas = useDatos('/producido/rutas');
  const [busetaElegida, setBusetaElegida] = useState(null);
  const [periodo, setPeriodo] = useState(mesActual);
  const [dialogo, setDialogo] = useState(null); // { tipo: 'vueltas' | 'excel' | 'tarifas', ... }

  const busetaId = busetaElegida ?? busetas?.[0]?.id ?? null;
  const ruta = busetaId ? `/producido?busetaId=${busetaId}&anio=${periodo.anio}&mes=${periodo.mes}` : null;
  const consulta = useDatos(ruta);

  // Cada guardado devuelve el mes completo recalculado: se usa en vez de la consulta.
  // Mientras carga otra buseta o mes, useDatos devuelve los datos anteriores:
  // solo se muestran si corresponden a lo elegido, para no editar el mes equivocado.
  const [actualizado, setActualizado] = useState({ ruta: null, mes: null });
  const coincide = (m) => m && m.buseta.id === busetaId && m.anio === periodo.anio && m.mes === periodo.mes;
  const mes = actualizado.ruta === ruta ? actualizado.mes : coincide(consulta.datos) ? consulta.datos : null;
  const alActualizar = (nuevo) => setActualizado({ ruta, mes: nuevo });
  const cerrarDialogo = () => setDialogo(null);

  // Quita la liquidación de la cooperativa: el mes vuelve a quedar abierto.
  async function reabrir() {
    if (!window.confirm('¿Quitar la liquidación? El mes vuelve a quedar abierto y se calcula con los días.')) return;
    try {
      alActualizar(
        await api(`/producido/${mes.buseta.id}/liquidacion?anio=${mes.anio}&mes=${mes.mes}`, { method: 'DELETE' }),
      );
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Producido</h1>
          <p className="subtitulo">Registro diario de cada buseta y resumen del mes.</p>
        </div>
        <div className="producido-herramientas">
          <button
            type="button"
            className="boton-secundario-oscuro"
            disabled={!mes || mes.cerrado}
            onClick={() => setDialogo({ tipo: 'excel' })}
          >
            Pegar desde Excel
          </button>
          <button
            type="button"
            className="boton-secundario-oscuro"
            disabled={!rutas.datos}
            onClick={() => setDialogo({ tipo: 'tarifas' })}
          >
            Tarifas de rutas
          </button>
          <button
            type="button"
            className="boton-secundario-oscuro"
            disabled={!mes}
            onClick={() => setDialogo({ tipo: 'liquidacion' })}
          >
            Liquidación de la cooperativa
          </button>
          <DescargarPdf mes={mes} />
        </div>
      </div>

      <div className="producido-filtros">
        {busetas && (
          <CampoSeleccion
            etiqueta="Buseta"
            valor={busetaId}
            alCambiar={setBusetaElegida}
            opciones={busetas.map((b) => ({ valor: b.id, texto: `${b.numeroInterno} · ${b.placa}` }))}
          />
        )}
        <SelectorMes valor={periodo} alCambiar={setPeriodo} />
      </div>

      {busetas?.length === 0 && <p className="vacio">Primero registra una buseta en el módulo Busetas.</p>}
      {consulta.error && <p className="error">{consulta.error}</p>}
      {ruta && !mes && <p className="vacio">Cargando…</p>}

      {mes && (
        <>
          <div className="producido-contexto">
            <h2>
              {mes.buseta.numeroInterno} · {mes.buseta.placa}
              <span> — {nombreMes(mes.anio, mes.mes)}</span>
            </h2>
            <p className="detalle">
              Conductor: {mes.buseta.conductor?.nombre ?? 'sin asignar'}
              {mes.cerrado && <span className="etiqueta etiqueta-oscura">Mes cerrado</span>}
            </p>
            <div className="producido-acciones-mes">
              <CierreMes key={`cierre-${mes.buseta.id}-${mes.anio}-${mes.mes}`} mes={mes} alActualizar={alActualizar} />
              <AvisarConductor key={`${mes.buseta.id}-${mes.anio}-${mes.mes}`} mes={mes} />
            </div>
            {!mes.buseta.conductor && !mes.cerrado && (
              <p className="aviso">Asigna un conductor a esta buseta (módulo Conductores) para poder registrar su producido.</p>
            )}
          </div>

          <div className="producido-cuerpo">
            <CuadriculaMes
              mes={mes}
              alActualizar={alActualizar}
              abrirVueltas={(info, aplicar) => setDialogo({ tipo: 'vueltas', info, aplicar })}
            />
            {mes.liquidacion ? (
              <LiquidacionCooperativa
                liquidacion={mes.liquidacion}
                anio={mes.anio}
                mes={mes.mes}
                acciones={
                  <div className="liquidacion-acciones">
                    <button type="button" className="boton-enlace" onClick={() => setDialogo({ tipo: 'liquidacion' })}>
                      Corregir
                    </button>
                    <button type="button" className="boton-enlace" onClick={reabrir}>
                      Quitar la liquidación (reabrir el mes)
                    </button>
                  </div>
                }
              />
            ) : (
              <ResumenMes mes={mes} alActualizar={alActualizar} />
            )}
          </div>

          {mes.conciliacion && <Conciliacion conciliacion={mes.conciliacion} />}

          <SeccionColpass key={mes.buseta.id} busetaId={mes.buseta.id} cambio={mes.resumen.peajes} />
        </>
      )}

      <Dialogo
        abierto={dialogo?.tipo === 'vueltas'}
        titulo={dialogo?.info ? `Vueltas del día ${dialogo.info.dia}` : 'Vueltas'}
        alCerrar={cerrarDialogo}
      >
        {rutas.datos && (
          <CalculoVueltas
            rutas={rutas.datos.rutas}
            alAplicar={(peajes, salidas) => {
              dialogo.aplicar(peajes, salidas);
              cerrarDialogo();
            }}
          />
        )}
      </Dialogo>

      <Dialogo abierto={dialogo?.tipo === 'excel'} titulo="Pegar desde Excel" alCerrar={cerrarDialogo}>
        {mes && <PegarExcel mes={mes} alActualizar={alActualizar} alTerminar={cerrarDialogo} />}
      </Dialogo>

      <Dialogo abierto={dialogo?.tipo === 'liquidacion'} titulo="Liquidación de la cooperativa" alCerrar={cerrarDialogo}>
        {mes && (
          <FormularioLiquidacion
            mes={mes}
            alGuardar={(nuevo) => {
              alActualizar(nuevo);
              cerrarDialogo();
            }}
          />
        )}
      </Dialogo>

      <Dialogo abierto={dialogo?.tipo === 'tarifas'} titulo="Tarifas de rutas" alCerrar={cerrarDialogo}>
        {rutas.datos && <TarifasRutas rutas={rutas.datos.rutas} alGuardar={rutas.recargar} />}
      </Dialogo>
    </>
  );
}

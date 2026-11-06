import { useRef, useState } from 'react';
import { api } from '../../compartido/api.js';
import { useSesion } from '../../compartido/sesion/contexto.js';
import { CampoSeleccion } from '../../compartido/ui/Campos.jsx';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { SelectorMes } from '../../compartido/ui/SelectorMes.jsx';
import { fecha, mesActual, nombreMes, pesos } from '../../compartido/utilidades/formato.js';
import { comprimirImagen } from '../../compartido/utilidades/imagenes.js';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { CATEGORIAS } from './categorias.js';
import { FormularioFactura } from './FormularioFactura.jsx';
import './facturas.css';

// Facturas del mes (soporte de los gastos, con foto opcional). El conductor ve
// y registra las de su buseta ("Mis facturas"); el admin, las de todas o las de
// una. Son solo respaldo: el cálculo del mes sale de la cuadrícula del producido.
export function PaginaFacturas() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'admin';
  const busetas = useDatos(esAdmin ? '/busetas' : null).datos?.busetas.filter((b) => b.activo);
  const [periodo, setPeriodo] = useState(mesActual);
  const [busetaId, setBusetaId] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [viendo, setViendo] = useState(null); // factura cuya foto se está viendo

  const ruta = `/facturas?anio=${periodo.anio}&mes=${periodo.mes}${busetaId ? `&busetaId=${busetaId}` : ''}`;
  const { datos, error, cargando, recargar } = useDatos(ruta);
  const facturas = datos?.facturas ?? [];
  const porCategoria = Object.keys(CATEGORIAS)
    .map((c) => [c, facturas.filter((f) => f.categoria === c).reduce((t, f) => t + f.precio, 0)])
    .filter(([, total]) => total > 0);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>{esAdmin ? 'Facturas' : 'Mis facturas'}</h1>
          <p className="subtitulo">
            {esAdmin
              ? 'El soporte de los gastos de cada buseta, con su foto.'
              : 'Guarda aquí las facturas de lo que pagas (repuestos, ACPM, peajes) con su foto.'}
          </p>
        </div>
        <button type="button" className="boton-principal" onClick={() => setNueva(true)}>
          + Registrar factura
        </button>
      </div>

      <div className="facturas-filtros">
        {esAdmin && busetas && (
          <CampoSeleccion
            etiqueta="Buseta"
            valor={busetaId}
            alCambiar={setBusetaId}
            vacio="Todas"
            opciones={busetas.map((b) => ({ valor: b.id, texto: `${b.numeroInterno} · ${b.placa}` }))}
          />
        )}
        <SelectorMes valor={periodo} alCambiar={setPeriodo} />
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && !datos && <p className="vacio">Cargando…</p>}

      {datos && (
        <section className="facturas-resumen" aria-label="Total del mes">
          <div>
            <small>Total de {nombreMes(periodo.anio, periodo.mes)}</small>
            <strong>{pesos(datos.total)}</strong>
            <small>
              {facturas.length} {facturas.length === 1 ? 'factura' : 'facturas'}
            </small>
          </div>
          {porCategoria.length > 0 && (
            <dl>
              {porCategoria.map(([c, total]) => (
                <div key={c}>
                  <dt>{CATEGORIAS[c]}</dt>
                  <dd>{pesos(total)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      {datos && facturas.length === 0 && (
        <p className="vacio">No hay facturas en {nombreMes(periodo.anio, periodo.mes)}.</p>
      )}

      <ul className="facturas-lista">
        {facturas.map((f) => (
          <Factura key={f.id} factura={f} esAdmin={esAdmin} alCambiar={recargar} alVer={() => setViendo(f)} />
        ))}
      </ul>

      {!esAdmin && datos?.diasEdicion && facturas.length > 0 && (
        <p className="ayuda">Puedes agregar la foto o borrar lo que registraste durante {datos.diasEdicion} días.</p>
      )}

      <Dialogo abierto={nueva} titulo="Registrar factura" alCerrar={() => setNueva(false)}>
        <FormularioFactura
          busetas={esAdmin ? (busetas ?? []) : null}
          busetaInicial={busetaId}
          alGuardar={(factura) => {
            setNueva(false);
            setPeriodo({ anio: Number(factura.fecha.slice(0, 4)), mes: Number(factura.fecha.slice(5, 7)) });
            recargar();
          }}
        />
      </Dialogo>

      <Dialogo
        abierto={Boolean(viendo)}
        titulo={viendo ? `${viendo.descripcion} · ${pesos(viendo.precio)}` : 'Foto'}
        alCerrar={() => setViendo(null)}
      >
        {viendo && <img className="factura-imagen" src={`/api/facturas/${viendo.id}/foto`} alt={`Factura: ${viendo.descripcion}`} />}
      </Dialogo>
    </>
  );
}

function Factura({ factura: f, esAdmin, alCambiar, alVer }) {
  const entrada = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  async function hacer(accion) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      alCambiar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function subirFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    await hacer(async () => api(`/facturas/${f.id}/foto`, { method: 'PUT', cuerpo: await comprimirImagen(archivo) }));
  }

  function borrar() {
    if (!window.confirm(`¿Borrar la factura "${f.descripcion}" de ${pesos(f.precio)}?`)) return;
    hacer(() => api(`/facturas/${f.id}`, { method: 'DELETE' }));
  }

  return (
    <li className="factura">
      <div className="factura-datos">
        <span className="factura-fecha">{fecha(f.fecha)}</span>
        <strong>{f.descripcion}</strong>
        <span className="factura-detalle">
          <span className="etiqueta">{CATEGORIAS[f.categoria]}</span>
          {esAdmin && (
            <span>
              {f.numeroInterno} · {f.conductor}
            </span>
          )}
        </span>
      </div>
      <strong className="factura-precio">{pesos(f.precio)}</strong>
      <div className="factura-acciones">
        {f.tieneFoto ? (
          <button type="button" className="boton-secundario-oscuro" onClick={alVer}>
            📷 Ver foto
          </button>
        ) : (
          f.editable && (
            <>
              <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={subirFoto} />
              <button type="button" className="boton-secundario-oscuro" disabled={ocupado} onClick={() => entrada.current.click()}>
                {ocupado ? 'Subiendo…' : 'Agregar foto'}
              </button>
            </>
          )
        )}
        {f.editable && (
          <button type="button" className="boton-enlace" disabled={ocupado} onClick={borrar}>
            Borrar
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </li>
  );
}

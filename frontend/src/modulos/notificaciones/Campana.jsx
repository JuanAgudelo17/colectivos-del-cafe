import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../compartido/api.js';
import { Dialogo } from '../../compartido/ui/Dialogo.jsx';
import { Icono } from '../../compartido/ui/Iconos.jsx';
import { useDatos } from '../../compartido/utilidades/useDatos.js';
import { useEnvio } from '../../compartido/utilidades/useEnvio.js';
import {
  activarPush,
  desactivarPush,
  esIphoneSinInstalar,
  permisoDenegado,
  pushSoportado,
  sincronizarPush,
} from './push.js';
import './notificaciones.css';

const CADA_CINCO_MINUTOS = 5 * 60 * 1000;
const relativo = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

// "hace 3 horas", "ayer"…
function cuando(iso) {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutos > -1) return 'hace un momento';
  if (minutos > -60) return relativo.format(minutos, 'minute');
  if (minutos > -60 * 24) return relativo.format(Math.round(minutos / 60), 'hour');
  return relativo.format(Math.round(minutos / (60 * 24)), 'day');
}

// Campanita del panel: cuántos avisos sin leer, la lista y activar las
// notificaciones en este celular. Va en la barra lateral y en la barra del celular.
export function Campana() {
  const navegar = useNavigate();
  const [abierta, setAbierta] = useState(false);
  const { datos, recargar } = useDatos('/notificaciones');
  const noLeidas = datos?.noLeidas ?? 0;

  // Se actualiza cada cinco minutos mientras la app está abierta.
  useEffect(() => {
    const intervalo = setInterval(recargar, CADA_CINCO_MINUTOS);
    return () => clearInterval(intervalo);
  }, [recargar]);

  async function abrirAviso(aviso) {
    setAbierta(false);
    if (!aviso.leidaEn) await api('/notificaciones/leidas', { method: 'POST', cuerpo: { ids: [aviso.id] } }).catch(() => {});
    recargar();
    navegar(aviso.url);
  }

  async function leerTodas() {
    await api('/notificaciones/leidas', { method: 'POST', cuerpo: {} }).catch(() => {});
    recargar();
  }

  return (
    <>
      <button
        type="button"
        className="campana"
        onClick={() => {
          setAbierta(true);
          recargar();
        }}
        aria-label={noLeidas ? `Avisos: ${noLeidas} sin leer` : 'Avisos'}
      >
        <Icono nombre="campana" tamano={22} />
        {noLeidas > 0 && (
          <span className="campana-contador" aria-hidden="true">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      <Dialogo abierto={abierta} titulo="Avisos" alCerrar={() => setAbierta(false)}>
        {datos?.push.disponible && <ActivarEnEsteCelular clavePublica={datos.push.clavePublica} />}

        {!datos ? (
          <p className="vacio">Cargando…</p>
        ) : datos.notificaciones.length === 0 ? (
          <p className="avisos-vacio">No tienes avisos. Aquí te llegarán los recordatorios de documentos, mantenimiento y más.</p>
        ) : (
          <>
            <ul className="avisos-lista">
              {datos.notificaciones.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={n.leidaEn ? 'aviso-item' : 'aviso-item aviso-nuevo'}
                    onClick={() => abrirAviso(n)}
                  >
                    <strong>{n.titulo}</strong>
                    <span>{n.cuerpo}</span>
                    <small>
                      {!n.leidaEn && <span className="aviso-punto" aria-label="Sin leer" />}
                      {cuando(n.creadaEn)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {noLeidas > 0 && (
              <button type="button" className="boton-enlace avisos-leer-todas" onClick={leerTodas}>
                Marcar todas como leídas
              </button>
            )}
          </>
        )}
      </Dialogo>
    </>
  );
}

// Tarjeta para activar (o desactivar y probar) las notificaciones push en este celular.
function ActivarEnEsteCelular({ clavePublica }) {
  const [activas, setActivas] = useState(null); // null = revisando
  const [mensaje, setMensaje] = useState(null);
  const { enviando, error, enviar } = useEnvio();

  useEffect(() => {
    if (!pushSoportado()) return;
    sincronizarPush()
      .then(setActivas)
      .catch(() => setActivas(false));
  }, []);

  if (!pushSoportado()) {
    return esIphoneSinInstalar() ? (
      <p className="avisos-celular">
        <strong>¿Quieres recibir los avisos en tu iPhone?</strong> Primero agrega la app a la pantalla de inicio
        (Compartir → Agregar a inicio), ábrela desde ahí y actívalos.
      </p>
    ) : null;
  }

  if (permisoDenegado()) {
    return (
      <p className="avisos-celular">
        Bloqueaste las notificaciones de este sitio. Para recibirlas, actívalas en los ajustes del navegador.
      </p>
    );
  }

  if (activas === null) return null;

  return (
    <div className="avisos-celular">
      {error && <p className="error">{error}</p>}
      {mensaje && <p className="ok">{mensaje}</p>}
      {activas ? (
        <>
          <p>
            <strong>✓ Notificaciones activadas en este celular.</strong>
          </p>
          <div className="avisos-celular-acciones">
            <button
              type="button"
              className="boton-secundario-oscuro"
              disabled={enviando}
              onClick={async () => {
                setMensaje(null);
                const r = await enviar(() => api('/notificaciones/prueba', { method: 'POST' }));
                if (r) setMensaje('Listo: te debió llegar una notificación de prueba.');
              }}
            >
              Probar
            </button>
            <button
              type="button"
              className="boton-enlace"
              disabled={enviando}
              onClick={async () => {
                setMensaje(null);
                if ((await enviar(() => desactivarPush().then(() => true))) !== undefined) setActivas(false);
              }}
            >
              Desactivar
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            <strong>Recibe los recordatorios en este celular</strong> aunque la app esté cerrada: documentos por
            vencer, mantenimientos y más.
          </p>
          <button
            type="button"
            className="boton-principal"
            disabled={enviando}
            onClick={async () => {
              setMensaje(null);
              if ((await enviar(() => activarPush(clavePublica).then(() => true))) !== undefined) setActivas(true);
            }}
          >
            {enviando ? 'Activando…' : 'Activar notificaciones'}
          </button>
        </>
      )}
    </div>
  );
}

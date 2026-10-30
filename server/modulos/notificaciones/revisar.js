import { hoyBogota } from '../../compartido/fecha.js';
import { listarBusetas } from '../busetas/index.js';
import { pendientesColpass } from '../colpass/index.js';
import { estadoDeLaFlota } from '../mantenimiento/index.js';
import { enviadorDesdeEntorno } from './envio.js';
import { armarRecordatorios } from './recordatorios.js';
import {
  borrarSuscripcion,
  guardarNotificaciones,
  producidoCargadoDesde,
  suscripcionesDe,
  usuariosActivos,
} from './repositorio.js';

// Con más avisos nuevos que estos, al celular le llega uno solo que los resume.
const MAX_PUSH_POR_USUARIO = 3;

// Guarda los avisos (la campanita) y manda los nuevos al celular de quien activó
// las notificaciones. Los repetidos por clave se ignoran. La usan la revisión
// diaria y el botón "Avisarle al conductor" de Producido.
export async function notificar(db, avisos, { enviador = enviadorDesdeEntorno() } = {}) {
  const nuevas = await guardarNotificaciones(db, avisos);
  if (!enviador.configurado || nuevas.length === 0) return { creadas: nuevas.length, enviadas: 0 };

  const rolDe = new Map((await usuariosActivos(db)).map((u) => [u.id, u.rol]));
  const suscripciones = await suscripcionesDe(db, [...new Set(nuevas.map((n) => n.usuarioId))]);
  let enviadas = 0;

  for (const usuarioId of new Set(nuevas.map((n) => n.usuarioId))) {
    const suyas = nuevas.filter((n) => n.usuarioId === usuarioId);
    const mensajes =
      suyas.length <= MAX_PUSH_POR_USUARIO
        ? suyas.map(({ titulo, cuerpo, url, clave }) => ({ titulo, cuerpo, url, clave }))
        : [
            {
              titulo: `Tienes ${suyas.length} avisos nuevos`,
              cuerpo: suyas.map((n) => n.titulo).slice(0, 3).join(' · '),
              url: rolDe.get(usuarioId) === 'admin' ? '/admin' : '/conductor',
              clave: 'resumen',
            },
          ];

    for (const s of suscripciones.filter((x) => x.usuarioId === usuarioId)) {
      for (const mensaje of mensajes) {
        const resultado = await enviador.enviar(s, mensaje);
        if (resultado === 'enviada') enviadas += 1;
        if (resultado === 'vencida') {
          await borrarSuscripcion(db, s.endpoint);
          break;
        }
      }
    }
  }

  return { creadas: nuevas.length, enviadas };
}

// Revisión diaria: genera los recordatorios y los notifica. La corre la función
// programada de Netlify (7 a. m. Bogotá) o `npm run recordatorios`.
export async function revisarRecordatorios(db, { enviador = enviadorDesdeEntorno(), hoy = hoyBogota() } = {}) {
  const [usuarios, busetas, flota, colpass, producidoNuevo] = await Promise.all([
    usuariosActivos(db),
    listarBusetas(db),
    estadoDeLaFlota(db),
    pendientesColpass(db),
    producidoCargadoDesde(db, 24),
  ]);
  return notificar(db, armarRecordatorios({ hoy, usuarios, busetas, flota, colpass, producidoNuevo }), { enviador });
}

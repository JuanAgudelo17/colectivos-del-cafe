import { hoyBogota } from '../../compartido/fecha.js';
import { listarBusetas } from '../busetas/index.js';
import { pendientesColpass } from '../colpass/index.js';
import { estadoDeLaFlota } from '../mantenimiento/index.js';
import { enviadorDesdeEntorno } from './envio.js';
import { armarRecordatorios } from './recordatorios.js';
import { borrarSuscripcion, guardarNotificaciones, suscripcionesDe, usuariosActivos } from './repositorio.js';

// Con más avisos nuevos que estos, al celular le llega uno solo que los resume.
const MAX_PUSH_POR_USUARIO = 3;

// Revisión diaria: genera los recordatorios, guarda los nuevos (la campanita) y
// los manda al celular de quien activó las notificaciones. La corre la función
// programada de Netlify (7 a. m. Bogotá) o `npm run recordatorios`.
export async function revisarRecordatorios(db, { enviador = enviadorDesdeEntorno(), hoy = hoyBogota() } = {}) {
  const [usuarios, busetas, flota, colpass] = await Promise.all([
    usuariosActivos(db),
    listarBusetas(db),
    estadoDeLaFlota(db),
    pendientesColpass(db),
  ]);

  const nuevas = await guardarNotificaciones(db, armarRecordatorios({ hoy, usuarios, busetas, flota, colpass }));
  if (!enviador.configurado || nuevas.length === 0) return { creadas: nuevas.length, enviadas: 0 };

  const rolDe = new Map(usuarios.map((u) => [u.id, u.rol]));
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

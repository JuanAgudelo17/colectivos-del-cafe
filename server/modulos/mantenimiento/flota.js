import { listarBusetas } from '../busetas/index.js';
import { armarEstados } from './estado.js';
import { kilometrajesActuales, listarTipos, ultimosPorTipo } from './repositorio.js';

// Estado de mantenimiento de cada buseta activa: kilometraje actual y, por tipo,
// vencido / pronto / al día. Lo usan GET /mantenimiento y el panel del admin.
export async function estadoDeLaFlota(db) {
  const [busetas, tipos, kilometrajes, ultimos] = await Promise.all([
    listarBusetas(db),
    listarTipos(db),
    kilometrajesActuales(db),
    ultimosPorTipo(db),
  ]);

  return busetas
    .filter((b) => b.activo)
    .map((b) => {
      const kilometraje = kilometrajes.find((k) => k.busetaId === b.id) ?? null;
      return {
        id: b.id,
        numeroInterno: b.numeroInterno,
        placa: b.placa,
        kilometraje: kilometraje && { actual: kilometraje.actual, fecha: kilometraje.fecha },
        estados: armarEstados(
          tipos,
          ultimos.filter((u) => u.busetaId === b.id),
          kilometraje?.actual ?? null,
        ),
      };
    });
}

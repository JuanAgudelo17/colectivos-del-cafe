import { hoyBogota } from '../../compartido/fecha.js';
import { repartir } from './reparto.js';
import { diasConPeajes, listarColpass, listarEntregas } from './repositorio.js';

// Cuenta del Colpass: los peajes desde que hay Colpass y las entregas, repartidas
// en orden (las entregas cubren primero los días más viejos).
export async function estadoDeCuenta(db, busetaId, colpass) {
  const [dias, entregas] = await Promise.all([
    diasConPeajes(db, busetaId, colpass.desde, hoyBogota()),
    listarEntregas(db, busetaId),
  ]);
  return repartir(dias, entregas);
}

// Lo pendiente por entregar de cada buseta con Colpass (para los recordatorios).
export async function pendientesColpass(db) {
  const conColpass = await listarColpass(db);
  return Promise.all(
    conColpass.map(async (c) => ({ busetaId: c.busetaId, ...(await estadoDeCuenta(db, c.busetaId, c)).pendiente })),
  );
}

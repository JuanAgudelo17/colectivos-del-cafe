// Qué recordatorios le tocan a cada usuario hoy. Función pura (sin base de
// datos): recibe el estado de la flota y devuelve la lista de avisos. Cada aviso
// lleva una `clave` para no repetirlo (la base de datos ignora las repetidas).
//
//   Documentos: al quedar a 30, 7 y 1 día(s) de vencer, y al vencerse.
//   Mantenimiento: cuando un tipo pasa a "pronto" y cuando pasa a "vencido".
//   Kilometraje: una vez por semana si no se reporta hace más de 7 días (solo conductor).
//   Colpass: una vez por semana si hay peajes por entregar al propietario.
//
// Le llegan al conductor de la buseta y a todos los admin activos.
import { diasEntre } from '../../compartido/fecha.js';

const NOMBRES_DOCUMENTO = {
  soat: 'SOAT',
  tecnomecanica: 'Tecnomecánica',
  tarjetaOperacion: 'Tarjeta de operación',
  polizaRcc: 'Póliza contractual (RCC)',
  polizaRce: 'Póliza extracontractual (RCE)',
  extintor: 'Extintor',
};

const DIAS_KILOMETRAJE = 7;

const fechaCorta = (iso) => iso.split('-').reverse().join('/');
const pesos = (valor) => `$ ${new Intl.NumberFormat('es-CO').format(valor)}`;
const km = (valor) => `${new Intl.NumberFormat('es-CO').format(valor)} km`;

// Lunes de la semana de `hoy` ('YYYY-MM-DD'): los avisos semanales usan la semana en la clave.
export function lunesDe(hoy) {
  const fecha = new Date(`${hoy}T12:00:00Z`);
  const desdeLunes = (fecha.getUTCDay() + 6) % 7;
  return new Date(fecha.getTime() - desdeLunes * 86_400_000).toISOString().slice(0, 10);
}

// En qué tramo está un documento (null = todavía no hay que avisar).
function tramoDocumento(dias) {
  if (dias < 0) return 'vencido';
  if (dias <= 1) return '1';
  if (dias <= 7) return '7';
  if (dias <= 30) return '30';
  return null;
}

function cuandoVence(dias) {
  if (dias < 0) return 'se venció';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

function textoMantenimiento({ estado, kmRestantes, dias }) {
  const partes = [];
  if (kmRestantes !== null) partes.push(kmRestantes < 0 ? `se pasó por ${km(-kmRestantes)}` : `faltan ${km(kmRestantes)}`);
  if (dias !== null) partes.push(dias < 0 ? `venció hace ${-dias} días` : `faltan ${dias} días`);
  const detalle = partes.join(' o ');
  return estado === 'vencido' ? `Ya toca: ${detalle}.` : `Toca pronto: ${detalle}.`;
}

/**
 * @param {object} p
 * @param {string} p.hoy  'YYYY-MM-DD' (Bogotá)
 * @param {Array<{id, rol, busetaId}>} p.usuarios  usuarios activos
 * @param {Array<{id, numeroInterno, activo, documentos}>} p.busetas
 * @param {Array<{id, kilometraje, estados}>} p.flota  estado de mantenimiento por buseta
 * @param {Array<{busetaId, total}>} p.colpass  peajes pendientes por entregar
 */
export function armarRecordatorios({ hoy, usuarios, busetas, flota, colpass }) {
  const admins = usuarios.filter((u) => u.rol === 'admin');
  const conductorDe = (busetaId) => usuarios.find((u) => u.rol === 'conductor' && u.busetaId === busetaId);
  const semana = lunesDe(hoy);
  const avisos = [];

  // Arma el aviso para cada destinatario; `url` depende del rol.
  const avisar = ({ buseta, clave, tipo, titulo, cuerpo, urlConductor, urlAdmin, soloConductor = false }) => {
    const conductor = conductorDe(buseta.id);
    if (conductor && urlConductor) {
      avisos.push({ usuarioId: conductor.id, clave, tipo, titulo, cuerpo: cuerpo.conductor, url: urlConductor });
    }
    if (soloConductor) return;
    for (const admin of admins) {
      avisos.push({ usuarioId: admin.id, clave, tipo, titulo, cuerpo: cuerpo.admin, url: urlAdmin });
    }
  };

  for (const buseta of busetas.filter((b) => b.activo)) {
    const etiqueta = `la ${buseta.numeroInterno}`;
    const fichaAdmin = `/admin/busetas/${buseta.id}`;

    // ---- Documentos
    for (const [clave, nombre] of Object.entries(NOMBRES_DOCUMENTO)) {
      const documento = buseta.documentos?.[clave];
      if (!documento?.fecha) continue;
      const tramo = tramoDocumento(documento.dias);
      if (!tramo) continue;
      const vencido = tramo === 'vencido';
      avisar({
        buseta,
        clave: `doc:${buseta.id}:${clave}:${documento.fecha}:${tramo}`,
        tipo: 'documento',
        titulo: `${nombre} de ${etiqueta} ${cuandoVence(documento.dias)}`,
        cuerpo: {
          conductor: vencido
            ? `Venció el ${fechaCorta(documento.fecha)}. Avísale al administrador para renovarlo.`
            : `Vence el ${fechaCorta(documento.fecha)}. Avísale al administrador para renovarlo a tiempo.`,
          admin: vencido
            ? `Venció el ${fechaCorta(documento.fecha)}. Renuévalo y actualiza la fecha.`
            : `Vence el ${fechaCorta(documento.fecha)}.`,
        },
        urlConductor: '/conductor/documentos',
        urlAdmin: fichaAdmin,
      });
    }

    const mantenimiento = flota.find((f) => f.id === buseta.id);

    // ---- Mantenimiento (pronto / vencido), una vez por estado y por registro
    for (const e of mantenimiento?.estados ?? []) {
      if (e.estado !== 'pronto' && e.estado !== 'vencido') continue;
      avisar({
        buseta,
        clave: `mant:${buseta.id}:${e.tipo}:${e.ultimo?.id ?? 'nunca'}:${e.estado}`,
        tipo: 'mantenimiento',
        titulo: `${e.nombre} de ${etiqueta}`,
        cuerpo: { conductor: textoMantenimiento(e), admin: textoMantenimiento(e) },
        urlConductor: '/conductor#mantenimiento',
        urlAdmin: fichaAdmin,
      });
    }

    // ---- Kilometraje sin reportar (solo al conductor, una vez por semana)
    const ultimoKm = mantenimiento?.kilometraje?.fecha;
    if (!ultimoKm || diasEntre(ultimoKm, hoy) > DIAS_KILOMETRAJE) {
      avisar({
        buseta,
        clave: `km:${buseta.id}:${semana}`,
        tipo: 'kilometraje',
        titulo: 'Registra el kilometraje de tu buseta',
        cuerpo: {
          conductor: ultimoKm
            ? `El último reporte fue el ${fechaCorta(ultimoKm)}. Así sabemos cuándo toca cada mantenimiento.`
            : 'Todavía no lo has reportado. Así sabemos cuándo toca cada mantenimiento.',
        },
        urlConductor: '/conductor#mantenimiento',
        soloConductor: true,
      });
    }

    // ---- Peajes Colpass por entregar (una vez por semana)
    const pendiente = colpass.find((c) => c.busetaId === buseta.id);
    if (pendiente?.total > 0) {
      avisar({
        buseta,
        clave: `colpass:${buseta.id}:${semana}`,
        tipo: 'colpass',
        titulo: `Peajes Colpass por entregar: ${pesos(pendiente.total)}`,
        cuerpo: {
          conductor: 'Es la plata de los peajes que guardas para el propietario. Cuando la entregues, regístrala.',
          admin: `El conductor de ${etiqueta} tiene ${pesos(pendiente.total)} de peajes Colpass por entregar.`,
        },
        urlConductor: '/conductor/mi-producido/peajes',
        urlAdmin: '/admin/producido',
      });
    }
  }

  return avisos;
}

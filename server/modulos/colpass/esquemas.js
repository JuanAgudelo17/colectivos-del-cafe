import { z } from 'zod';
import { textoOpcional } from '../../compartido/http/validacion.js';

const fecha = z.iso.date({ message: 'Fecha inválida' });

// Rango de consulta; si falta, la página usa el mes actual.
export const rangoConsulta = z
  .object({ desde: fecha.optional(), hasta: fecha.optional() })
  .refine((r) => !r.desde || !r.hasta || r.desde <= r.hasta, {
    message: 'La fecha inicial debe ser antes de la final',
    path: ['hasta'],
  });

export const activarEsquema = z.object({ desde: fecha });

export const liquidacionEsquema = z
  .object({ desde: fecha, hasta: fecha, observacion: textoOpcional(200) })
  .refine((r) => r.desde <= r.hasta, { message: 'La fecha inicial debe ser antes de la final', path: ['hasta'] });

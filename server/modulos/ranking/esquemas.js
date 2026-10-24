import { z } from 'zod';

// Mes y año opcionales (si faltan, el mes actual). El mes va con el año.
export const mesOpcional = z
  .object({
    anio: z.coerce.number().int().min(2020).max(2100).optional(),
    mes: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((q) => (q.anio === undefined) === (q.mes === undefined), { message: 'Envía año y mes', path: ['mes'] });

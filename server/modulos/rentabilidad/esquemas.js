import { z } from 'zod';

export const anioConsulta = z.object({
  anio: z.coerce.number().int().min(2020).max(2100).optional(),
});

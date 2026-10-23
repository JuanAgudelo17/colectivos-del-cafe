import { z } from 'zod';
import { pesos, textoOpcional } from '../../compartido/http/validacion.js';

// Vacío o ausente = 0 (en la planilla los días sin ACPM se dejan en blanco).
const pesosDia = z.preprocess((v) => (v === null || v === undefined || v === '' ? 0 : v), pesos);

export const mesConsulta = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

export const diaEsquema = z.object({
  ingreso: pesosDia,
  peajes: pesosDia,
  salidas: pesosDia,
  acpm: pesosDia,
  mantenimiento: pesosDia,
  relevo: z.boolean().default(false),
  observacion: textoOpcional(300),
});

export const ajusteEsquema = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  tipo: z.enum(['bono', 'prestamo'], { message: 'Tipo inválido' }),
  descripcion: textoOpcional(200),
  valor: pesos.refine((v) => v > 0, 'El valor debe ser mayor que cero'),
});

export const rutaEsquema = z.object({
  peajeTrayecto: pesos,
  salidaIda: pesos,
  salidaRegreso: pesos,
});

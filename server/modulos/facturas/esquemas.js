import { z } from 'zod';
import { hoyBogota } from '../../compartido/fecha.js';
import { pesos, texto } from '../../compartido/http/validacion.js';

export const CATEGORIAS = ['peaje', 'mantenimiento', 'acpm', 'salida', 'otro'];

export const facturaEsquema = z.object({
  fecha: z.iso.date({ message: 'Fecha inválida' }).refine((f) => f <= hoyBogota(), 'No puede ser una fecha futura'),
  categoria: z.enum(CATEGORIAS, { message: 'Categoría inválida' }).default('otro'),
  descripcion: texto(200, 'Escribe qué se compró o pagó'),
  precio: pesos.refine((v) => v > 0, 'El precio debe ser mayor que cero'),
  // Solo el admin: de qué buseta es (el conductor siempre registra en la suya).
  busetaId: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
});

export const consultaEsquema = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  busetaId: z.coerce.number().int().positive().optional(),
});

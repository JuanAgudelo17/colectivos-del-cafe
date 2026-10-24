import { z } from 'zod';
import { hoyBogota } from '../../compartido/fecha.js';
import { fechaOpcional, textoOpcional } from '../../compartido/http/validacion.js';

const km = z.coerce
  .number({ message: 'Kilometraje inválido' })
  .int('Sin decimales')
  .min(0, 'Kilometraje inválido')
  .max(9_999_999, 'Kilometraje inválido');

// '' o ausente → null (z.coerce convertiría '' en 0).
const vacioANull = (v) => (v === '' || v == null ? null : v);
const kmOpcional = z.preprocess(vacioANull, km.nullable());

const fechaPasada = z.iso
  .date({ message: 'Fecha inválida' })
  .refine((f) => f <= hoyBogota(), 'No puede ser una fecha futura');

export const lecturaEsquema = z.object({
  fecha: fechaPasada,
  kilometraje: km,
});

const proximo = { proximoKm: kmOpcional, proximaFecha: fechaOpcional };

// Un mismo día y kilometraje pueden cubrir varios trabajos
// (ej. aceite + filtro de aceite + filtro de aire): uno por item.
export const registroCrear = z
  .object({
    fecha: fechaPasada,
    kilometraje: kmOpcional,
    observacion: textoOpcional(300),
    items: z
      .array(z.object({ tipo: z.string().trim().min(1), ...proximo }))
      .min(1, 'Elige qué mantenimiento se hizo')
      .max(20),
  })
  .superRefine((r, ctx) => {
    const tipos = r.items.map((i) => i.tipo);
    if (new Set(tipos).size !== tipos.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Hay un tipo de mantenimiento repetido' });
    }
  });

export const registroEditar = z.object({
  tipo: z.string().trim().min(1),
  fecha: fechaPasada,
  kilometraje: kmOpcional,
  observacion: textoOpcional(300),
  ...proximo,
});

const intervalo = (max, mensaje) =>
  z.preprocess(vacioANull, z.coerce.number({ message: mensaje }).int(mensaje).min(1, mensaje).max(max, mensaje).nullable());

export const tipoEditar = z.object({
  intervaloKm: intervalo(500_000, 'Kilómetros inválidos'),
  intervaloMeses: intervalo(120, 'Meses inválidos'),
});

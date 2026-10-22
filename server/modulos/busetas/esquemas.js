import { z } from 'zod';
import { fechaOpcional, pesos, texto, textoOpcional } from '../../compartido/http/validacion.js';

const camposBuseta = {
  numeroInterno: texto(20),
  placa: z
    .string()
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
    .refine((v) => /^[A-Z0-9]{5,7}$/.test(v), 'Placa inválida (ej: ABC123)'),
  modelo: textoOpcional(60),
  tieneCupo: z.boolean(),
  valorArriendo: pesos.nullish().transform((v) => v ?? null),
  fechaSoat: fechaOpcional,
  fechaTecnomecanica: fechaOpcional,
};

// Sin cupo → arriendo obligatorio. Con cupo → el arriendo no aplica y se guarda null.
const reglaArriendo = (esquema) =>
  esquema
    .refine((b) => b.tieneCupo || b.valorArriendo !== null, {
      path: ['valorArriendo'],
      message: 'Indica el valor del arriendo (la buseta no tiene cupo)',
    })
    .transform((b) => (b.tieneCupo ? { ...b, valorArriendo: null } : b));

export const busetaCrear = reglaArriendo(z.object(camposBuseta));
export const busetaEditar = reglaArriendo(z.object({ ...camposBuseta, activo: z.boolean() }));

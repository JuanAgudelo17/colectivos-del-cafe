import { z } from 'zod';
import { id, opcionalConFormato, texto } from '../../compartido/http/validacion.js';

const camposConductor = {
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, 'De 3 a 30 caracteres: letras, números, punto o guion, sin espacios'),
  nombre: texto(120),
  cedula: opcionalConFormato(/^\d{5,12}$/, 'Cédula inválida: solo números', (v) => v.replace(/[.\s]/g, '')),
  telefono: opcionalConFormato(/^\+?\d{7,15}$/, 'Teléfono inválido', (v) => v.replace(/[\s()-]/g, '')),
  busetaId: id.nullish().transform((v) => v ?? null),
};

export const conductorCrear = z.object(camposConductor);
export const conductorEditar = z.object({ ...camposConductor, activo: z.boolean() });

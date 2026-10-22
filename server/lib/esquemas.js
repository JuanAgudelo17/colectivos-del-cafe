// Esquemas de validación de los formularios del admin.
import { z } from 'zod';
import { fechaOpcional, id, pesos, texto, textoOpcional } from './validacion.js';

// Texto opcional con formato: se limpia con `limpiar`, '' → null, si no cumple `regex` → error.
const opcionalConFormato = (regex, mensaje, limpiar = (v) => v) =>
  z
    .string()
    .nullish()
    .transform((v) => (v == null ? '' : limpiar(v.trim())))
    .refine((v) => v === '' || regex.test(v), mensaje)
    .transform((v) => v || null);

// ---- Empresa ----------------------------------------------------------------

const camposEmpresa = {
  nombre: texto(120),
  nit: opcionalConFormato(/^[0-9-]{5,20}$/, 'NIT inválido: solo números y guion', (v) => v.replace(/[.\s]/g, '')),
};

export const empresaCrear = z.object(camposEmpresa);
export const empresaEditar = z.object({ ...camposEmpresa, activo: z.boolean() });

// ---- Buseta -----------------------------------------------------------------

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

export const busetaCrear = reglaArriendo(z.object({ empresaId: id, ...camposBuseta }));
export const busetaEditar = reglaArriendo(z.object({ ...camposBuseta, activo: z.boolean() }));

// ---- Conductor --------------------------------------------------------------

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

export const conductorCrear = z.object({ empresaId: id, ...camposConductor });
export const conductorEditar = z.object({ ...camposConductor, activo: z.boolean() });

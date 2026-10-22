import { z } from 'zod';
import { ErrorHttp } from './errores.js';

z.config(z.locales.es());

// Valida `datos` con el esquema; si falla, lanza 400 con un mensaje por campo.
export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos ?? {});
  if (resultado.success) return resultado.data;

  const campos = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path.join('.') || '_';
    campos[campo] ??= issue.message;
  }
  throw new ErrorHttp(400, 'Revisa los datos del formulario', campos);
}

// Id numérico de la URL (/busetas/:id). Uno inválido se trata como inexistente.
export function idDeRuta(req, nombre = 'id') {
  const id = Number(req.params[nombre]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(404, 'Registro no encontrado');
  return id;
}

// ---- Piezas reutilizables para los esquemas ---------------------------------

// Texto obligatorio, sin espacios sobrantes.
export const texto = (max, mensaje = 'Este campo es obligatorio') =>
  z.string().trim().min(1, mensaje).max(max);

// Texto opcional: '' o ausente → null.
export const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const id = z.coerce.number().int().positive();

// Fecha 'YYYY-MM-DD' opcional: '' o ausente → null.
export const fechaOpcional = z
  .union([z.iso.date({ message: 'Fecha inválida' }), z.literal('')])
  .nullish()
  .transform((v) => v || null);

// Texto opcional con formato: se limpia con `limpiar`, '' → null, si no cumple `regex` → error.
export const opcionalConFormato = (regex, mensaje, limpiar = (v) => v) =>
  z
    .string()
    .nullish()
    .transform((v) => (v == null ? '' : limpiar(v.trim())))
    .refine((v) => v === '' || regex.test(v), mensaje)
    .transform((v) => v || null);

// Pesos colombianos enteros, sin decimales.
export const pesos = z.coerce.number({ message: 'Valor inválido' }).int('Sin decimales').min(0).max(1_000_000_000_000);

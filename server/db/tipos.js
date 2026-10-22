// Cómo convertir tipos de Postgres a JavaScript, igual en pg (Supabase) y PGlite (tests).
export const PARSERS = {
  // BIGINT → number. Pesos e ids caben de sobra en un número seguro (2^53).
  20: Number,
  // DATE → texto 'YYYY-MM-DD'. Convertirlo a Date lo correría por zona horaria.
  1082: (valor) => valor,
};

-- 013_aviso_producido.sql
-- Nuevo tipo de aviso: "producido", cuando el admin carga el producido (aviso
-- automático en la revisión diaria o con el botón "Avisarle" de Producido).
ALTER TABLE notificacion DROP CONSTRAINT notificacion_tipo_check;
ALTER TABLE notificacion
  ADD CONSTRAINT notificacion_tipo_check
  CHECK (tipo IN ('documento', 'mantenimiento', 'kilometraje', 'colpass', 'producido'));

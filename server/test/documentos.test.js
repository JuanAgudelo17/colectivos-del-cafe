import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDocumento } from '../lib/documentos.js';
import { diasEntre, hoyBogota } from '../lib/fecha.js';

const HOY = '2026-10-22';

test('diasEntre cuenta días de calendario', () => {
  assert.equal(diasEntre('2026-10-22', '2026-11-21'), 30);
  assert.equal(diasEntre('2026-10-22', '2026-10-21'), -1);
  assert.equal(diasEntre('2026-02-28', '2026-03-01'), 1);
});

test('hoyBogota usa la fecha de Bogotá', () => {
  assert.equal(hoyBogota(new Date('2026-03-01T03:30:00Z')), '2026-02-28');
});

test('estadoDocumento', () => {
  assert.deepEqual(estadoDocumento(null, HOY), { fecha: null, estado: 'sin_fecha', dias: null });
  assert.deepEqual(estadoDocumento('2026-10-21', HOY), { fecha: '2026-10-21', estado: 'vencido', dias: -1 });
  assert.equal(estadoDocumento('2026-10-22', HOY).estado, 'por_vencer'); // vence hoy
  assert.equal(estadoDocumento('2026-11-21', HOY).estado, 'por_vencer'); // justo 30 días
  assert.equal(estadoDocumento('2026-11-22', HOY).estado, 'vigente'); // 31 días
});

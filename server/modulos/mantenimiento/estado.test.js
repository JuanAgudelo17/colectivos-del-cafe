import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarEstados, estadoMantenimiento, puedeEditar } from './estado.js';

const HOY = '2026-10-22';

test('sin registro', () => {
  assert.deepEqual(estadoMantenimiento(null, 120000, HOY), { estado: 'sin_registro', kmRestantes: null, dias: null });
});

test('por kilometraje: al día, pronto (≤ 500 km) y vencido', () => {
  const ultimo = { proximoKm: 125000, proximaFecha: null };
  assert.deepEqual(estadoMantenimiento(ultimo, 124000, HOY), { estado: 'al_dia', kmRestantes: 1000, dias: null });
  assert.equal(estadoMantenimiento(ultimo, 124500, HOY).estado, 'pronto'); // justo 500
  assert.equal(estadoMantenimiento(ultimo, 125000, HOY).estado, 'pronto'); // toca hoy
  assert.deepEqual(estadoMantenimiento(ultimo, 125001, HOY), { estado: 'vencido', kmRestantes: -1, dias: null });
});

test('por fecha: al día, pronto (≤ 15 días) y vencido', () => {
  const con = (proximaFecha) => estadoMantenimiento({ proximoKm: null, proximaFecha }, 120000, HOY);
  assert.deepEqual(con('2026-11-07'), { estado: 'al_dia', kmRestantes: null, dias: 16 });
  assert.equal(con('2026-11-06').estado, 'pronto'); // 15 días
  assert.equal(con('2026-10-22').estado, 'pronto'); // hoy
  assert.equal(con('2026-10-21').estado, 'vencido');
});

test('vence por lo que llegue primero: km o fecha', () => {
  // Faltan muchos km pero ya pasó la fecha.
  assert.equal(estadoMantenimiento({ proximoKm: 200000, proximaFecha: '2026-10-01' }, 120000, HOY).estado, 'vencido');
  // Falta mucho tiempo pero ya pasó el km.
  assert.equal(estadoMantenimiento({ proximoKm: 119000, proximaFecha: '2027-06-01' }, 120000, HOY).estado, 'vencido');
  // Uno al día y el otro pronto → pronto.
  assert.equal(estadoMantenimiento({ proximoKm: 120300, proximaFecha: '2027-06-01' }, 120000, HOY).estado, 'pronto');
});

test('sin kilometraje actual solo cuenta la fecha', () => {
  const r = estadoMantenimiento({ proximoKm: 125000, proximaFecha: '2027-01-01' }, null, HOY);
  assert.deepEqual(r, { estado: 'al_dia', kmRestantes: null, dias: 71 });
});

test('armarEstados: una tarjeta por tipo activo con intervalo', () => {
  const tipos = [
    { clave: 'aceite', nombre: 'Cambio de aceite', intervaloKm: 5000, intervaloMeses: 3, activo: true },
    { clave: 'bateria', nombre: 'Batería', intervaloKm: null, intervaloMeses: 24, activo: false },
    { clave: 'correas', nombre: 'Correas', intervaloKm: 40000, intervaloMeses: 12, activo: true },
    { clave: 'otro', nombre: 'Otro', intervaloKm: null, intervaloMeses: null, activo: true },
  ];
  const ultimos = [{ id: 7, tipo: 'aceite', fecha: '2026-09-01', kilometraje: 118000, proximoKm: 123000, proximaFecha: '2026-12-01' }];
  const estados = armarEstados(tipos, ultimos, 122800, HOY);

  assert.deepEqual(
    estados.map((e) => [e.tipo, e.estado]),
    [
      ['aceite', 'pronto'],
      ['correas', 'sin_registro'],
    ],
  );
  assert.deepEqual(estados[0].ultimo, { id: 7, fecha: '2026-09-01', kilometraje: 118000, proximoKm: 123000, proximaFecha: '2026-12-01' });
  assert.equal(estados[0].kmRestantes, 200);
});

test('puedeEditar: el admin siempre; el conductor lo suyo y por 7 días', () => {
  const ahora = new Date('2026-10-22T12:00:00Z');
  const hace = (dias) => new Date(ahora - dias * 86_400_000);
  const conductor = { id: 5, rol: 'conductor' };
  const suyo = (dias) => ({ registradoPor: { id: 5 }, creadoEn: hace(dias) });

  assert.equal(puedeEditar({ id: 1, rol: 'admin' }, { registradoPor: { id: 5 }, creadoEn: hace(400) }, ahora), true);
  assert.equal(puedeEditar(conductor, suyo(0), ahora), true);
  assert.equal(puedeEditar(conductor, suyo(7), ahora), true);
  assert.equal(puedeEditar(conductor, suyo(7.01), ahora), false);
  assert.equal(puedeEditar(conductor, { registradoPor: { id: 1 }, creadoEn: hace(0) }, ahora), false);
});

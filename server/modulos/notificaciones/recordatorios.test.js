import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { armarRecordatorios, lunesDe } from './recordatorios.js';

const HOY = '2026-10-24'; // sábado
const documento = (dias, fecha = '2026-11-01') => ({ fecha, dias, estado: dias < 0 ? 'vencido' : 'por_vencer' });
const sinFecha = { fecha: null, dias: null, estado: 'sin_fecha' };
const documentos = (otros = {}) => ({
  soat: sinFecha,
  tecnomecanica: sinFecha,
  tarjetaOperacion: sinFecha,
  polizaRcc: sinFecha,
  polizaRce: sinFecha,
  extintor: sinFecha,
  ...otros,
});

const USUARIOS = [
  { id: 1, rol: 'admin', busetaId: null },
  { id: 2, rol: 'conductor', busetaId: 10 },
];
const BUSETA = { id: 10, numeroInterno: '2033', activo: true, documentos: documentos() };
// Kilometraje reportado hace poco: no genera aviso de kilometraje.
const FLOTA_AL_DIA = [{ id: 10, kilometraje: { actual: 120000, fecha: '2026-10-22' }, estados: [] }];

const armar = (cambios = {}) =>
  armarRecordatorios({ hoy: HOY, usuarios: USUARIOS, busetas: [BUSETA], flota: FLOTA_AL_DIA, colpass: [], ...cambios });

test('lunes de la semana', () => {
  assert.equal(lunesDe('2026-10-24'), '2026-10-19');
  assert.equal(lunesDe('2026-10-19'), '2026-10-19');
  assert.equal(lunesDe('2026-10-25'), '2026-10-19'); // domingo
});

describe('documentos', () => {
  test('avisa al entrar a cada tramo (30, 7, 1 días y vencido) al conductor y al admin', () => {
    const tramos = [
      [45, null],
      [30, '30'],
      [12, '30'],
      [7, '7'],
      [1, '1'],
      [0, '1'],
      [-3, 'vencido'],
    ];
    for (const [dias, tramo] of tramos) {
      const avisos = armar({ busetas: [{ ...BUSETA, documentos: documentos({ soat: documento(dias) }) }] });
      if (!tramo) {
        assert.equal(avisos.length, 0, `${dias} días`);
        continue;
      }
      assert.deepEqual(avisos.map((a) => a.usuarioId).sort(), [1, 2], `${dias} días`);
      assert.equal(avisos[0].clave, `doc:10:soat:2026-11-01:${tramo}`);
    }
  });

  test('textos y enlaces según el rol', () => {
    const avisos = armar({ busetas: [{ ...BUSETA, documentos: documentos({ tecnomecanica: documento(7) }) }] });
    const delConductor = avisos.find((a) => a.usuarioId === 2);
    const delAdmin = avisos.find((a) => a.usuarioId === 1);
    assert.equal(delConductor.titulo, 'Tecnomecánica de la 2033 vence en 7 días');
    assert.equal(delConductor.url, '/conductor/documentos');
    assert.match(delConductor.cuerpo, /Avísale al administrador/);
    assert.equal(delAdmin.url, '/admin/busetas/10');
    assert.equal(delAdmin.cuerpo, 'Vence el 01/11/2026.');
  });

  test('busetas desactivadas no avisan; sin conductor solo le llega al admin', () => {
    const vencida = { ...BUSETA, documentos: documentos({ soat: documento(-1) }) };
    assert.equal(armar({ busetas: [{ ...vencida, activo: false }] }).length, 0);
    const avisos = armar({ busetas: [vencida], usuarios: [USUARIOS[0]] });
    assert.deepEqual(avisos.map((a) => a.usuarioId), [1]);
  });
});

test('mantenimiento: una vez por estado (pronto y vencido) y por registro', () => {
  const flota = [
    {
      ...FLOTA_AL_DIA[0],
      estados: [
        { tipo: 'aceite', nombre: 'Cambio de aceite', estado: 'pronto', kmRestantes: 300, dias: null, ultimo: { id: 5 } },
        { tipo: 'frenos', nombre: 'Frenos', estado: 'vencido', kmRestantes: -1200, dias: null, ultimo: { id: 6 } },
        { tipo: 'correas', nombre: 'Correas', estado: 'al_dia', kmRestantes: 9000, dias: 200, ultimo: { id: 7 } },
        { tipo: 'bateria', nombre: 'Batería', estado: 'sin_registro', kmRestantes: null, dias: null, ultimo: null },
      ],
    },
  ];
  const avisos = armar({ flota }).filter((a) => a.usuarioId === 2);
  assert.deepEqual(
    avisos.map((a) => [a.clave, a.cuerpo]),
    [
      ['mant:10:aceite:5:pronto', 'Toca pronto: faltan 300 km.'],
      ['mant:10:frenos:6:vencido', 'Ya toca: se pasó por 1.200 km.'],
    ],
  );
  assert.equal(avisos[0].url, '/conductor#mantenimiento');
});

test('kilometraje: solo al conductor, una vez por semana, si no reporta hace más de 7 días', () => {
  const viejo = [{ id: 10, kilometraje: { actual: 1, fecha: '2026-10-10' }, estados: [] }];
  const avisos = armar({ flota: viejo });
  assert.deepEqual(avisos.map((a) => [a.usuarioId, a.clave]), [[2, 'km:10:2026-10-19']]);
  assert.match(avisos[0].cuerpo, /10\/10\/2026/);
  // Nunca reportado
  assert.equal(armar({ flota: [{ id: 10, kilometraje: null, estados: [] }] }).length, 1);
  // Reportado hace 7 días: todavía no
  assert.equal(armar({ flota: [{ id: 10, kilometraje: { actual: 1, fecha: '2026-10-17' }, estados: [] }] }).length, 0);
});

test('Colpass: con peajes pendientes, una vez por semana', () => {
  const avisos = armar({ colpass: [{ busetaId: 10, total: 908800 }] });
  assert.deepEqual(avisos.map((a) => [a.usuarioId, a.clave]), [
    [2, 'colpass:10:2026-10-19'],
    [1, 'colpass:10:2026-10-19'],
  ]);
  assert.equal(avisos[0].titulo, 'Peajes Colpass por entregar: $ 908.800');
  assert.equal(avisos[0].url, '/conductor/mi-producido/peajes');
  assert.equal(armar({ colpass: [{ busetaId: 10, total: 0 }] }).length, 0);
});

test('producido cargado en las últimas 24 h: solo al conductor, una vez por día', () => {
  const producidoNuevo = [{ busetaId: 10, dias: 3, desde: '2026-10-21', hasta: '2026-10-23', producido: 2_450_000 }];
  const avisos = armar({ producidoNuevo });
  assert.deepEqual(avisos.map((a) => [a.usuarioId, a.clave, a.tipo]), [[2, 'producido:10:2026-10-24', 'producido']]);
  assert.equal(avisos[0].titulo, 'Se cargó tu producido de 3 días');
  assert.match(avisos[0].cuerpo, /del 21\/10\/2026 al 23\/10\/2026: \$ 2\.450\.000/);
  assert.equal(avisos[0].url, '/conductor/mi-producido?anio=2026&mes=10');
  // Un solo día
  const uno = armar({ producidoNuevo: [{ busetaId: 10, dias: 1, desde: '2026-10-23', hasta: '2026-10-23', producido: 500_000 }] });
  assert.equal(uno[0].titulo, 'Se cargó tu producido de 1 día');
  assert.match(uno[0].cuerpo, /^Producido del 23\/10\/2026:/);
});

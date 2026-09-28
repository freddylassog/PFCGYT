import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anticipacionVigente, cumple72h, diasMinimos, faltasDias, plazoTexto } from '../../lib/reglas';

test('anticipación configurable: 72 h normal, 24 h temporal con fecha límite', () => {
  assert.equal(diasMinimos(72), 3);
  assert.equal(diasMinimos(24), 1);
  assert.equal(diasMinimos(48), 2);
  const hoy = '2026-09-28';
  assert.equal(cumple72h('2026-09-29', hoy), false, 'con 72 h mañana no alcanza');
  assert.equal(cumple72h('2026-09-29', hoy, 24), true, 'con 24 h mañana sí');
  assert.equal(cumple72h('2026-09-28', hoy, 24), false, 'hoy mismo no');
  assert.equal(plazoTexto('2026-09-29', hoy, 24), '1 día de anticipación');
  assert.equal(plazoTexto('2026-09-29', hoy), '24 h · menos de 72 h');
  assert.deepEqual(faltasDias([{ fecha: '2026-09-29', inicio: '09:00', fin: '12:00', lugar: 'X' }], hoy, true, 24), []);
  assert.deepEqual(faltasDias([{ fecha: '2026-09-29', inicio: '09:00', fin: '12:00', lugar: 'X' }], hoy), ['fecha con al menos 72 h']);
});

test('la excepción caduca sola', () => {
  const a = { anticipacionHoras: 24, anticipacionHasta: '2026-10-04' };
  assert.equal(anticipacionVigente(a, '2026-09-28'), 24);
  assert.equal(anticipacionVigente(a, '2026-10-04'), 24, 'el último día todavía rige');
  assert.equal(anticipacionVigente(a, '2026-10-05'), 72, 'al día siguiente vuelve a 72');
  assert.equal(anticipacionVigente({ anticipacionHoras: 48, anticipacionHasta: '' }, '2027-01-01'), 48, 'sin fecha límite aplica siempre');
  assert.equal(anticipacionVigente({ anticipacionHoras: 0, anticipacionHasta: '' }, '2026-09-28'), 72, 'valor inválido → 72');
});

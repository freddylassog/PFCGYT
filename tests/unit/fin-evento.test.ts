import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_VISIBLES, ESTADO_PLURAL, estadoVisible, tagClass, tipoClass } from '../../lib/reglas';

test('un aprobado con fin de evento se ve como Finalizado (verde); los demás estados no cambian', () => {
  assert.equal(estadoVisible({ estado: 'Aprobado', finalizadoAt: '2026-09-26' }), 'Finalizado');
  assert.equal(estadoVisible({ estado: 'Aprobado', finalizadoAt: null }), 'Aprobado');
  assert.equal(estadoVisible({ estado: 'Pendiente', finalizadoAt: '2026-09-26' }), 'Pendiente');
  assert.equal(estadoVisible({ estado: 'Rechazado', finalizadoAt: null }), 'Rechazado');
  assert.equal(tagClass('Finalizado'), 'tag-verde');
  assert.equal(tagClass('Aprobado'), 'tag-accent');
});

test('colores por tipo y columnas del tablero', () => {
  assert.equal(tipoClass('interno'), 'tipo-interno');
  assert.equal(tipoClass('externo'), 'tipo-externo');
  assert.deepEqual(ESTADOS_VISIBLES, ['Pendiente', 'Ajustes', 'Aprobado', 'Finalizado', 'Rechazado']);
  assert.equal(ESTADO_PLURAL.Ajustes, 'En ajustes');
  assert.equal(ESTADO_PLURAL.Finalizado, 'Finalizados');
});

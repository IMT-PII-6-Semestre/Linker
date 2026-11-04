import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anosDesde, cnpjValido, cpfValido } from './auth.schema.js';

test('cpfValido', () => {
  assert.equal(cpfValido('52998224725'), true);
  assert.equal(cpfValido('52998224724'), false);
  assert.equal(cpfValido('11111111111'), false);
  assert.equal(cpfValido('123'), false);
});

test('cnpjValido', () => {
  assert.equal(cnpjValido('11222333000181'), true);
  assert.equal(cnpjValido('11222333000182'), false);
  assert.equal(cnpjValido('00000000000000'), false);
});

test('anosDesde respeita o aniversário', () => {
  const hoje = new Date(2026, 5, 15); // 15/06/2026
  assert.equal(anosDesde('2000-06-15', hoje), 26);
  assert.equal(anosDesde('2000-06-16', hoje), 25);
  assert.equal(anosDesde('2030-01-01', hoje) < 0, true);
});

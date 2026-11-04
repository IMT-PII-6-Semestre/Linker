import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mulberry32, normalizar, simularSwipes, sortearPesos, validarLado } from './validacao.js';

const LADO_A = ['cargo', 'salario', 'local'];
const LADO_B = ['cargo', 'skills', 'experiencia', 'escolaridade', 'texto', 'local'];

test('PRNG com semente: mesma semente, mesma sequência; sementes diferentes divergem', () => {
  const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test('sortearPesos: positivos e somam 1', () => {
  const p = sortearPesos(mulberry32(1), 6);
  assert.ok(p.every((v) => v > 0));
  assert.ok(Math.abs(p.reduce((s, v) => s + v, 0) - 1) < 1e-12);
});

test('simularSwipes: features em [0,1] e likes perto de 50% (pesos somam 1)', () => {
  const { X, y } = simularSwipes(mulberry32(3), [0.5, 0.3, 0.2], 4000, 10);
  assert.equal(X.length, 4000);
  assert.ok(X.flat().every((v) => v >= 0 && v <= 1));
  const taxa = y.reduce((s, v) => s + v, 0) / y.length;
  assert.ok(taxa > 0.45 && taxa < 0.55, `taxa de likes ${taxa}`);
});

test('normalizar: zera negativos, soma 1; tudo ≤ 0 devolve zeros (nunca NaN)', () => {
  assert.deepEqual(normalizar([3, -1, 1]), [0.75, 0, 0.25]);
  assert.deepEqual(normalizar([-2, 0, -0.1]), [0, 0, 0]);
});

// O critério do plano: ~5k swipes sintéticos, erro < 0,1 por feature. Várias sementes, para não depender de sorte.
for (const [nome, features] of [['A (candidato)', LADO_A], ['B (empresa)', LADO_B]] as const) {
  test(`recupera os pesos ocultos do lado ${nome} com 5k swipes (erro < 0,1 em 5 sementes)`, () => {
    for (const semente of [1, 2, 3, 4, 5]) {
      const r = validarLado(mulberry32(semente), [...features], { n: 5000 });
      assert.ok(r.erroMax < 0.1, `semente ${semente}: erro máximo ${r.erroMax.toFixed(3)}`);
      assert.ok(Math.abs(Object.values(r.estimados).reduce((s, v) => s + v, 0) - 1) < 1e-9);
    }
  });
}

test('validarLado é reprodutível com a mesma semente', () => {
  const um = validarLado(mulberry32(9), LADO_A, { n: 1000 });
  const dois = validarLado(mulberry32(9), LADO_A, { n: 1000 });
  assert.deepEqual(um, dois);
});

test('poucos swipes ou decisão quase aleatória (β pequeno) recuperam pior: o critério depende dos dados', () => {
  const bom = validarLado(mulberry32(1), LADO_B, { n: 5000, beta: 10 }).erroMax;
  const ruido = validarLado(mulberry32(1), LADO_B, { n: 5000, beta: 0.2 }).erroMax;
  assert.ok(ruido > bom, `β=0,2 deveria errar mais (${ruido.toFixed(3)} vs ${bom.toFixed(3)})`);
});

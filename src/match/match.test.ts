import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ordenarComExploracao } from './exploracao.js';
import * as f from './features.js';
import { combinar, scoreLado } from './score.js';

const perto = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('skills: obrigatória pesa 2×, sem acento/caixa, vaga sem skills vale 1', () => {
  assert.equal(f.skills(['node.js', 'SQL'], ['Node.js', 'SQL'], ['TypeScript']), 4 / 5);
  assert.equal(f.skills(['Programação'], ['programacao'], []), 1);
  assert.equal(f.skills(['x'], ['a'], ['b']), 0);
  assert.equal(f.skills([], [], []), 1);
  assert.equal(f.skills(['b'], ['a'], ['b']), 1 / 3);
});

test('experiência: min(1, anos/mínimo); mínimo 0 vale 1', () => {
  assert.equal(f.experiencia(1, 2), 0.5);
  assert.equal(f.experiencia(5, 2), 1);
  assert.equal(f.experiencia(0, 0), 1);
});

test('escolaridade: perde 0,25 por nível abaixo; acima não ganha; fora do enum vale 0', () => {
  assert.equal(f.escolaridade('Superior completo', 'Superior completo'), 1);
  assert.equal(f.escolaridade('Pós-graduação', 'Médio'), 1);
  assert.equal(f.escolaridade('Técnico', 'Superior completo'), 0.5);
  assert.equal(f.escolaridade('Fundamental', 'Pós-graduação'), 0);
  assert.equal(f.escolaridade('???', 'Médio'), 0);
});

test('salário: mesma faixa 1, perde 0,25 por faixa, "A combinar" 0,6', () => {
  assert.equal(f.salario('R$ 4 a 6 mil', 'R$ 4 a 6 mil'), 1);
  assert.equal(f.salario('R$ 2 a 4 mil', 'R$ 6 a 10 mil'), 0.5);
  assert.equal(f.salario('Até R$ 2 mil', 'Acima de R$ 10 mil'), 0);
  assert.equal(f.salario('A combinar', 'R$ 4 a 6 mil'), 0.6);
  assert.equal(f.salario('R$ 4 a 6 mil', 'A combinar'), 0.6);
});

test('localização: remota 1, Haversine com decaimento, fallback cidade/UF, sem dado neutro', () => {
  const sp = { cidade: 'São Paulo', uf: 'SP', coord: { lat: -23.5632, lng: -46.6543 } };
  const rj = { cidade: 'Rio de Janeiro', uf: 'RJ', coord: { lat: -22.9004, lng: -43.178 } };
  assert.equal(f.localizacao(sp, rj, true), 1);
  perto(f.localizacao(sp, sp, false), 1);
  assert.ok(f.localizacao(sp, rj, false) < 0.01); // ~360 km
  perto(f.haversineKm(sp.coord, rj.coord), 360, 15);
  const semCoord = (l: typeof sp) => ({ ...l, coord: null });
  assert.equal(f.localizacao(semCoord(sp), semCoord(sp), false), 1);
  assert.equal(f.localizacao(semCoord(sp), { cidade: 'Campinas', uf: 'SP', coord: null }, false), 0.6);
  assert.equal(f.localizacao(semCoord(sp), semCoord(rj), false), 0.3);
  assert.equal(f.localizacao({ cidade: null, uf: null, coord: null }, sp, false), f.LOCAL_NEUTRO);
});

test('score: média ponderada, pesos zerados dão 0 e nunca NaN, geométrica penaliza desequilíbrio', () => {
  assert.equal(scoreLado({ a: 1, b: 0 }, { a: 3, b: 1 }), 0.75);
  assert.equal(scoreLado({ a: 1 }, { a: 0 }), 0);
  assert.equal(scoreLado({}, {}), 0);
  assert.equal(scoreLado({}, { a: 1 }), 0); // feature ausente conta como 0
  assert.equal(combinar(1, 0), 0);
  perto(combinar(0.9, 0.1), 0.3);
  assert.equal(combinar(0.5, 0.5), 0.5);
});

const itens = [
  { id: 3, score: 0.5 },
  { id: 1, score: 0.9 },
  { id: 2, score: 0.5 },
  { id: 4, score: 0.1 },
];

test('ε-greedy: rng alto nunca explora → ordem do score, empate pelo id', () => {
  const r = ordenarComExploracao(itens, () => 0.99);
  assert.deepEqual(r.map((x) => x.item.id), [1, 2, 3, 4]);
  assert.deepEqual(r.map((x) => x.posicao), [1, 2, 3, 4]);
  assert.ok(r.every((x) => !x.exploracao));
});

test('ε-greedy: sequência roteirizada força exploração só na posição 2', () => {
  // posição 1: 0.99 (não explora). posição 2: 0.01 (explora), 0.99 → último do que sobrou. resto: 0.99.
  const roteiro = [0.99, 0.01, 0.99, 0.99, 0.99];
  const r = ordenarComExploracao(itens, () => roteiro.shift() ?? 0.99);
  assert.deepEqual(r.map((x) => x.item.id), [1, 4, 2, 3]);
  assert.deepEqual(r.map((x) => x.exploracao), [false, true, false, false]);
});

test('ε-greedy: lista vazia, e rng 0 não estoura o índice', () => {
  assert.deepEqual(ordenarComExploracao([], Math.random), []);
  assert.equal(ordenarComExploracao(itens, () => 0).length, 4);
  assert.equal(ordenarComExploracao(itens, () => 0.999999).length, 4);
});

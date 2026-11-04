import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { pool } from './db/pool.js';
import { pesosAtivos, salvarPesos } from './repositories/feed.repository.js';

after(() => pool.end());

const totalVersoes = async () => (await pool.query('SELECT count(*)::int AS n FROM config_pesos')).rows[0].n as number;

test('salvarPesos grava a próxima versão inativa e não mexe na ativa', async () => {
  // Dentro de uma transação desfeita: o teste nunca deixa versão nova em config_pesos.
  let total = -1;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const antes = await pesosAtivos();
    total = await totalVersoes();
    const maior = (await cliente.query('SELECT max(versao) AS v FROM config_pesos')).rows[0].v;
    const pesos = { A: { cargo: 0.5, salario: 0.5 }, B: { skills: 1 } };

    const nova = await salvarPesos(pesos, cliente);
    assert.equal(nova, maior + 1);
    const { rows } = await cliente.query('SELECT pesos, ativa FROM config_pesos WHERE versao = $1', [nova]);
    assert.deepEqual(rows, [{ pesos, ativa: false }]);
    assert.equal((await cliente.query('SELECT versao FROM config_pesos WHERE ativa')).rows[0].versao, antes.versao);
    assert.equal(await salvarPesos(pesos, cliente), nova + 1); // chamadas seguidas não colidem
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }
  assert.equal(await totalVersoes(), total); // nada ficou gravado, mesmo com versões criadas por fora
});

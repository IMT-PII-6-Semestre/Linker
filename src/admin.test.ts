import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pool } from './db/pool.js';
import * as admin from './repositories/admin.repository.js';
import { anosDesde } from './schemas/auth.schema.js';
import { fixtures, usarServidor } from './test-helpers.js';

const { api } = usarServidor();
const json = async (res: Response) => (await res.json()) as any;
const { candidato, empresa } = fixtures(api);

const login = async (email: string, origin: string) =>
  (await json(await api('/api/auth/login', { metodo: 'POST', corpo: { email, senha: '123456', origin } }))).token as string;

test('acesso: sem token → 401; candidato e empresa → 403; admin → 200', async () => {
  assert.equal((await api('/api/admin/snapshot')).status, 401);
  for (const t of [(await candidato()).token, (await empresa()).token]) {
    assert.equal((await api('/api/admin/snapshot', { token: t })).status, 403);
  }
  assert.equal((await api('/api/admin/snapshot', { token: await login('admin@linker.com', 'web') })).status, 200);
});

test('snapshot via HTTP: formato do PlatformSnapshot e o seed dentro dos totais', async () => {
  const token = await login('admin@linker.com', 'web');
  const s = await json(await api('/api/admin/snapshot', { token }));
  assert.deepEqual(Object.keys(s).sort(), [
    'candidatoAges', 'curtidas', 'geradoEm', 'matches', 'matchesPorSemana', 'novos30dAnteriores',
    'novosUltimos30d', 'vagasPorEmpresa',
  ]);
  // Outros testes mexem na base ao mesmo tempo: aqui só o que nunca diminui. Os números exatos estão no teste de baixo.
  for (const idade of [anosDesde('2000-05-10'), anosDesde('2005-09-20')]) assert.ok(s.candidatoAges.includes(idade));
  assert.ok(s.vagasPorEmpresa.length >= 2 && s.vagasPorEmpresa.every((n: number) => n >= 0));
  assert.ok(s.novosUltimos30d >= 4); // candidatos e empresas do seed (o admin não conta)
  assert.ok(Math.abs(s.geradoEm - Date.now()) < 5000);

  assert.equal(s.matchesPorSemana.length, admin.SEMANAS);
  const inicios: number[] = s.matchesPorSemana.map((w: any) => w.inicio);
  assert.deepEqual(inicios, [...inicios].sort((a, b) => a - b)); // da mais antiga para a atual
  const { rows } = await pool.query(`SELECT floor(extract(epoch from date_trunc('week', now(), '${admin.FUSO}')) * 1000)::bigint AS ms`);
  assert.equal(inicios.at(-1), rows[0].ms); // a última é a semana corrente
});

test('agregações com números exatos, em tabelas temporárias (isoladas do que os outros testes fazem)', async () => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // As tabelas temporárias escondem as reais só nesta conexão (pg_temp vem primeiro no search_path).
    await cliente.query(`
      CREATE TEMP TABLE usuario (id bigint, tipo text, criado_em timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE perfil_candidato (usuario_id bigint, data_nascimento date) ON COMMIT DROP;
      CREATE TEMP TABLE empresa (usuario_id bigint) ON COMMIT DROP;
      CREATE TEMP TABLE vaga (id bigint, empresa_id bigint) ON COMMIT DROP;
      CREATE TEMP TABLE swipe (direcao text) ON COMMIT DROP;
      CREATE TEMP TABLE match (criado_em timestamptz) ON COMMIT DROP;

      INSERT INTO usuario VALUES
        (1, 'candidato', now() - interval '5 days'),    -- últimos 30 dias
        (2, 'candidato', now() - interval '29 days'),   -- últimos 30 dias
        (3, 'empresa',   now() - interval '31 days'),   -- 30 anteriores
        (4, 'empresa',   now() - interval '59 days'),   -- 30 anteriores
        (5, 'candidato', now() - interval '61 days'),   -- fora das duas janelas
        (6, 'admin',     now() - interval '1 day');     -- admin não conta
      INSERT INTO perfil_candidato VALUES
        (1, current_date - interval '25 years 1 day'), (2, current_date - interval '18 years 1 day'),
        (5, current_date - interval '40 years 1 day');
      INSERT INTO empresa VALUES (3), (4), (7);
      INSERT INTO vaga VALUES (1, 3), (2, 3), (3, 3), (4, 4);   -- empresa 3: 3 vagas, 4: 1, 7: nenhuma
      INSERT INTO swipe VALUES ('like'), ('like'), ('like'), ('pass'), ('pass');
      -- Semanas no horário de Brasília: começam na segunda 00:00 BRT (03:00 UTC).
      CREATE TEMP VIEW semana_atual AS SELECT date_trunc('week', now(), '${admin.FUSO}') AS w;
      INSERT INTO match SELECT w FROM semana_atual;                                -- semana atual
      INSERT INTO match SELECT w + interval '1 hour' FROM semana_atual;
      INSERT INTO match SELECT w - interval '2 hours' FROM semana_atual;          -- domingo 22h BRT: semana passada
      INSERT INTO match SELECT w - interval '49 days' FROM semana_atual;          -- 7 semanas atrás: a mais antiga da janela
      INSERT INTO match SELECT w - interval '56 days' FROM semana_atual;          -- 8 semanas atrás: fora
    `);
    const s = await admin.snapshot(cliente);

    assert.deepEqual([...s.candidatoAges].sort((a, b) => a - b), [18, 25, 40]);
    assert.deepEqual([...s.vagasPorEmpresa].sort((a, b) => a - b), [0, 1, 3]); // empresa sem vaga conta 0
    assert.equal(s.curtidas, 3); // só os likes, não os passes
    assert.equal(s.matches, 5);
    assert.equal(s.novosUltimos30d, 2);
    assert.equal(s.novos30dAnteriores, 2);
    assert.deepEqual(s.matchesPorSemana.map((w) => w.matches), [1, 0, 0, 0, 0, 0, 1, 2]); // semanas vazias = 0
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }
});

test('sem dados: listas vazias e zeros, nunca null', async () => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(`
      CREATE TEMP TABLE usuario (id bigint, tipo text, criado_em timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE perfil_candidato (usuario_id bigint, data_nascimento date) ON COMMIT DROP;
      CREATE TEMP TABLE empresa (usuario_id bigint) ON COMMIT DROP;
      CREATE TEMP TABLE vaga (id bigint, empresa_id bigint) ON COMMIT DROP;
      CREATE TEMP TABLE swipe (direcao text) ON COMMIT DROP;
      CREATE TEMP TABLE match (criado_em timestamptz) ON COMMIT DROP;`);
    const s = await admin.snapshot(cliente);
    assert.deepEqual([s.candidatoAges, s.vagasPorEmpresa, s.curtidas, s.matches, s.novosUltimos30d, s.novos30dAnteriores],
      [[], [], 0, 0, 0, 0]);
    assert.deepEqual(s.matchesPorSemana.map((w) => w.matches), new Array(admin.SEMANAS).fill(0));
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }
});

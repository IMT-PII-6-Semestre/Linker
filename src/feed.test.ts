import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pool } from './db/pool.js';
import { aleatorio } from './services/feed.service.js';
import { fixtures, usarServidor, vagaValida } from './test-helpers.js';

const { api } = usarServidor();
const json = async (res: Response) => (await res.json()) as any;
let n = 0;
const unico = () => `${Date.now()}${n++}`;
const nunca = () => 0.99; // ε-greedy nunca explora → ordem pura do score
aleatorio.rng = nunca;

const { candidato, empresa } = fixtures(api);
const novaVaga = async (token: string, over: Record<string, unknown>) =>
  (await json(await api('/api/vagas', { metodo: 'POST', token, corpo: { ...vagaValida, ...over } }))).id as string;

const feedDe = async (token: string, qs = '') => (await json(await api(`/api/feed${qs}`, { token }))) as any[];
const swipe = (token: string, corpo: unknown) => api('/api/swipe', { metodo: 'POST', token, corpo });
const ids = (posts: any[]) => posts.map((p) => p.id);
const contar = async (sql: string, args: unknown[]) => Number((await pool.query(sql, args)).rows[0].count);

test('acesso: sem token → 401, admin → 403, swipe inválido → 400, vaga inexistente → 404', async () => {
  assert.equal((await api('/api/feed')).status, 401);
  const admin = await json(await api('/api/auth/login', { metodo: 'POST', corpo: { email: 'admin@linker.com', senha: '123456', origin: 'web' } }));
  assert.equal((await api('/api/feed', { token: admin.token })).status, 403);

  const c = await candidato();
  assert.equal((await swipe(c.token, { postId: 'abc', direction: 'like' })).status, 400);
  assert.equal((await swipe(c.token, { postId: 1, direction: 'talvez' })).status, 400);
  assert.equal((await swipe(c.token, { postId: 999999999, direction: 'like' })).status, 404);
  const e = await empresa();
  assert.equal((await swipe(e.token, { postId: c.id, direction: 'like' })).status, 400); // empresa sem vagaId
  assert.equal((await swipe(e.token, { postId: 999999999, direction: 'like', vagaId: e.vagaId })).status, 404);
});

test('filtros eliminatórios: modalidade, tipo de contrato e Jovem Aprendiz (14–24 anos)', async () => {
  const c = await candidato({ tiposContrato: ['CLT', 'Jovem Aprendiz'], modalidades: ['Remoto'], dataNascimento: '10/05/1990' });
  const e = await empresa(); // Remoto + CLT: passa
  const presencial = await novaVaga(e.token, { modalidade: 'Presencial' });
  const estagio = await novaVaga(e.token, { tipoContrato: 'Estágio' });
  const aprendiz = await novaVaga(e.token, { tipoContrato: 'Jovem Aprendiz' }); // candidato tem 36 anos

  const vistas = ids(await feedDe(c.token));
  assert.ok(vistas.includes(e.vagaId));
  for (const fora of [presencial, estagio, aprendiz]) assert.ok(!vistas.includes(fora), `vaga ${fora} deveria ser eliminada`);

  // Mesmo par pelo lado da empresa: o candidato de 36 anos não aparece na vaga de aprendiz, o de 20 aparece.
  const jovem = await candidato({ tiposContrato: ['Jovem Aprendiz'], dataNascimento: '10/05/2006' });
  const paraAprendiz = ids(await feedDe(e.token, `?vagaId=${aprendiz}`));
  assert.ok(paraAprendiz.includes(String(jovem.id)));
  assert.ok(!paraAprendiz.includes(String(c.id)));
});

test('pass e like somem do feed de quem decidiu; o outro lado ainda vê', async () => {
  const c = await candidato();
  const e = await empresa();
  assert.ok(ids(await feedDe(c.token)).includes(e.vagaId));
  assert.ok(ids(await feedDe(e.token, `?vagaId=${e.vagaId}`)).includes(String(c.id)));

  assert.deepEqual(await json(await swipe(c.token, { postId: e.vagaId, direction: 'pass' })), { matched: false, matchId: null });
  assert.ok(!ids(await feedDe(c.token)).includes(e.vagaId));
  assert.ok(ids(await feedDe(e.token, `?vagaId=${e.vagaId}`)).includes(String(c.id))); // o pass do candidato não esconde da empresa

  await swipe(e.token, { postId: c.id, direction: 'like', vagaId: e.vagaId });
  assert.ok(!ids(await feedDe(e.token, `?vagaId=${e.vagaId}`)).includes(String(c.id)));
});

test('like + like gera match e chat; a primeira decisão de cada lado vale', async () => {
  const c = await candidato();
  const e = await empresa();

  const primeiro = await json(await swipe(c.token, { postId: e.vagaId, direction: 'like' }));
  assert.deepEqual(primeiro, { matched: false, matchId: null });
  const segundo = await json(await swipe(e.token, { postId: c.id, direction: 'like', vagaId: e.vagaId }));
  assert.equal(segundo.matched, true);
  assert.equal(typeof segundo.matchId, 'string');

  const par = [c.id, e.vagaId];
  assert.equal(await contar('SELECT count(*) FROM match WHERE candidato_id = $1 AND vaga_id = $2', par), 1);
  assert.equal(await contar('SELECT count(*) FROM chat WHERE match_id = $1', [segundo.matchId]), 1);

  // Repetir o like devolve o mesmo match, sem duplicar nada.
  const de_novo = await json(await swipe(c.token, { postId: e.vagaId, direction: 'like' }));
  assert.deepEqual(de_novo, { matched: true, matchId: segundo.matchId });
  assert.equal(await contar('SELECT count(*) FROM swipe WHERE candidato_id = $1 AND vaga_id = $2', par), 2);

  // Quem passou primeiro não vira like depois: pass → like continua pass, e não gera match.
  const c2 = await candidato();
  await swipe(c2.token, { postId: e.vagaId, direction: 'pass' });
  await swipe(e.token, { postId: c2.id, direction: 'like', vagaId: e.vagaId });
  const tentativa = await json(await swipe(c2.token, { postId: e.vagaId, direction: 'like' }));
  assert.deepEqual(tentativa, { matched: false, matchId: null });
  assert.equal(await contar('SELECT count(*) FROM match WHERE candidato_id = $1', [c2.id]), 0);
});

test('like simultâneo dos dois lados gera exatamente um match', async () => {
  for (let i = 0; i < 8; i++) {
    const c = await candidato();
    const e = await empresa();
    const [a, b] = await Promise.all([
      swipe(c.token, { postId: e.vagaId, direction: 'like' }).then(json),
      swipe(e.token, { postId: c.id, direction: 'like', vagaId: e.vagaId }).then(json),
    ]);
    assert.ok(a.matched || b.matched, `rodada ${i}: nenhum lado viu o match`);
    assert.equal(await contar('SELECT count(*) FROM match WHERE candidato_id = $1', [c.id]), 1);
    assert.equal(await contar('SELECT count(*) FROM chat c JOIN match m ON m.id = c.match_id WHERE m.candidato_id = $1', [c.id]), 1);
  }
});

test('feed da empresa: vaga de outra empresa → 403; sem vaga → []; vaga inexistente → 404', async () => {
  const a = await empresa();
  const b = await empresa();
  assert.equal((await api(`/api/feed?vagaId=${b.vagaId}`, { token: a.token })).status, 403);
  assert.equal((await api('/api/feed?vagaId=999999999', { token: a.token })).status, 404);
  assert.deepEqual(await feedDe(a.token), []);
  const c = await candidato();
  assert.equal((await swipe(a.token, { postId: c.id, direction: 'like', vagaId: b.vagaId })).status, 403);
  assert.equal(await contar('SELECT count(*) FROM swipe WHERE vaga_id = $1', [b.vagaId]), 0);
});

test('feed ordenado por score, com formato do FeedPost e linha em exibicao por item', async () => {
  const e = await empresa({ cargo: 'Analista de Dados', skillsObrigatorias: ['SQL', 'Python'], experienciaMinima: 2, escolaridade: 'Superior completo' });
  const bom = await candidato({ cargoDesejado: 'Analista de Dados', hardSkills: ['SQL', 'Python'], anosExperiencia: 3, escolaridade: 'Superior completo' });
  const ruim = await candidato({ cargoDesejado: 'Cozinheiro', hardSkills: ['Culinária'], anosExperiencia: 0, escolaridade: 'Fundamental' });

  const posts = await feedDe(e.token, `?vagaId=${e.vagaId}`);
  const meus = posts.filter((p) => [bom.id, ruim.id].includes(Number(p.id)));
  assert.deepEqual(ids(meus), [String(bom.id), String(ruim.id)]);
  assert.equal(meus[0].kind, 'candidato');
  assert.equal(meus[0].local, 'São Paulo - SP');
  assert.equal(typeof meus[0].idade, 'number');
  assert.deepEqual(meus[0].hardSkills, ['SQL', 'Python']);

  const { rows } = await pool.query(
    `SELECT * FROM exibicao WHERE vaga_id = $1 AND candidato_id = ANY($2) ORDER BY posicao`, [e.vagaId, [bom.id, ruim.id]]);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].score_final > rows[1].score_final);
  assert.ok(rows[0].posicao < rows[1].posicao);
  assert.equal(rows[0].visto_por, 'empresa');
  assert.equal(rows[0].versao_pesos, 1);
  assert.equal(rows[0].exploracao, false);
  assert.ok(Math.abs(rows[0].score_final - Math.sqrt(rows[0].score_a * rows[0].score_b)) < 1e-9);
  assert.deepEqual(Object.keys(rows[0].features_b).sort(), ['cargo', 'escolaridade', 'experiencia', 'local', 'skills', 'texto']);
  assert.deepEqual(Object.keys(rows[0].features_a).sort(), ['cargo', 'local', 'salario']);
  assert.equal(rows[0].features_b.skills, 1);

  // Lado do candidato: VagaPost, registrado como visto_por candidato.
  const vagas = await feedDe(bom.token);
  const vaga = vagas.find((v) => v.id === e.vagaId);
  assert.equal(vaga.kind, 'vaga');
  assert.equal(vaga.empresaId, String(e.id));
  assert.equal(vaga.vaga.cep, '01310-100');
  assert.equal(await contar(`SELECT count(*) FROM exibicao WHERE candidato_id = $1 AND visto_por = 'candidato'`, [bom.id]) > 0, true);
});

test('exploração: com rng baixo o log marca exploracao = true', async () => {
  const e = await empresa();
  const c = await candidato();
  aleatorio.rng = () => 0;
  try {
    await feedDe(e.token, `?vagaId=${e.vagaId}`);
  } finally {
    aleatorio.rng = nunca;
  }
  const { rows } = await pool.query('SELECT exploracao FROM exibicao WHERE vaga_id = $1 AND candidato_id = $2', [e.vagaId, c.id]);
  assert.deepEqual(rows, [{ exploracao: true }]);
});

test('bloqueio esconde o par nos dois sentidos', async () => {
  const c = await candidato();
  const e = await empresa();
  assert.ok(ids(await feedDe(c.token)).includes(e.vagaId));
  await pool.query('INSERT INTO bloqueio (autor_id, alvo_id) VALUES ($1, $2)', [e.id, c.id]);
  assert.ok(!ids(await feedDe(c.token)).includes(e.vagaId));
  assert.ok(!ids(await feedDe(e.token, `?vagaId=${e.vagaId}`)).includes(String(c.id)));
  await pool.query('DELETE FROM bloqueio WHERE autor_id = $1', [e.id]);
  await pool.query('INSERT INTO bloqueio (autor_id, alvo_id) VALUES ($1, $2)', [c.id, e.id]); // sentido inverso
  assert.ok(!ids(await feedDe(c.token)).includes(e.vagaId));
});

test('filtros do feed: uf e palavra-chave (sem acento, todas as palavras)', async () => {
  const marca = `Zyx${unico()}`;
  const c = await candidato();
  const e = await empresa({ cargo: `Engenheiro ${marca} Sênior` });

  assert.ok(ids(await feedDe(c.token, `?query=${marca.toLowerCase()}`)).includes(e.vagaId));
  assert.ok(ids(await feedDe(c.token, `?query=engenheiro+senior+${marca}`)).includes(e.vagaId));
  assert.ok(!ids(await feedDe(c.token, `?query=${marca}+inexistente`)).includes(e.vagaId));
  assert.ok(ids(await feedDe(c.token, '?uf=SP')).includes(e.vagaId));
  assert.ok(ids(await feedDe(c.token, '?uf=sp&query=')).includes(e.vagaId));
  assert.ok(!ids(await feedDe(c.token, '?uf=RJ')).includes(e.vagaId));
  assert.equal((await api('/api/feed?uf=SPX', { token: c.token })).status, 400);
});

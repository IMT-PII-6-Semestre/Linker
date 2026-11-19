import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pool } from './db/pool.js';
import { aleatorio } from './services/feed.service.js';
import { fixtures, usarServidor, vagaValida } from './test-helpers.js';

const { api } = usarServidor();
const json = async (res: Response) => (await res.json()) as any;
aleatorio.rng = () => 0.99;
const { candidato, empresa } = fixtures(api);

const post = (token: string, rota: string, corpo: unknown) => api(rota, { metodo: 'POST', token, corpo });
const contar = async (sql: string, args: unknown[]) => Number((await pool.query(sql, args)).rows[0].count);

/** Candidato e empresa com match feito; `conversa` é o id do match. */
async function par(vaga: Record<string, unknown> = {}) {
  const c = await candidato();
  const e = await empresa(vaga);
  await post(c.token, '/api/swipe', { postId: e.vagaId, direction: 'like' });
  const { matchId } = await json(await post(e.token, '/api/swipe', { postId: c.id, direction: 'like', vagaId: e.vagaId }));
  return { c, e, conversa: matchId as string };
}
const msgs = (token: string, conversa: string) => api(`/api/conversas/${conversa}/mensagens`, { token });
const enviar = (token: string, conversa: string, text: unknown) => post(token, `/api/conversas/${conversa}/mensagens`, { text });

test('acesso: sem token → 401, admin → 403, id inválido → 400', async () => {
  assert.equal((await api('/api/conversas')).status, 401);
  const admin = await json(await api('/api/auth/login', { metodo: 'POST', corpo: { email: 'admin@linker.com', senha: '123456', origin: 'web' } }));
  assert.equal((await api('/api/conversas', { token: admin.token })).status, 403);
  const c = await candidato();
  assert.equal((await api('/api/conversas/abc', { token: c.token })).status, 400);
});

test('fluxo completo: match → mensagens → não lidas → lidas', async () => {
  const { c, e, conversa } = await par({ cargo: 'Engenheira de Dados' });

  // Recém-criada: sem mensagens, sem não lidas, com o post que gerou o match.
  const inicial = await json(await api(`/api/conversas/${conversa}`, { token: c.token }));
  assert.equal(inicial.id, conversa);
  assert.equal(inicial.participantName, 'Teste Ltda');
  assert.equal('participantFotoUri' in inicial, false);
  assert.equal(inicial.subtitle, 'Engenheira de Dados');
  assert.equal(inicial.lastMessage, null);
  assert.equal(inicial.unreadCount, 0);
  assert.equal(inicial.post.kind, 'vaga');
  assert.equal(inicial.post.vaga.cargo, 'Engenheira de Dados');
  const doLadoDaEmpresa = await json(await api(`/api/conversas/${conversa}`, { token: e.token }));
  assert.equal(doLadoDaEmpresa.participantName, 'Teste Silva');
  assert.equal(doLadoDaEmpresa.subtitle, 'Dev'); // cargo desejado do candidato
  assert.equal(doLadoDaEmpresa.post.kind, 'candidato');
  assert.equal(doLadoDaEmpresa.post.id, String(c.id));

  // Duas mensagens do candidato → a empresa vê 2 não lidas; o candidato, nenhuma.
  const antes = Date.now();
  const m1 = await json(await enviar(c.token, conversa, '  Olá!  '));
  await enviar(c.token, conversa, 'Tudo bem?');
  assert.equal(m1.text, 'Olá!');
  assert.equal(m1.fromMe, true);
  assert.equal(m1.status, 'sent');
  assert.equal(m1.conversationId, conversa);
  assert.ok(m1.sentAt >= antes - 2000 && m1.sentAt <= Date.now() + 2000, 'sentAt em epoch ms');

  const listaEmpresa = await json(await api('/api/conversas', { token: e.token }));
  const naLista = listaEmpresa.find((x: any) => x.id === conversa);
  assert.equal(naLista.unreadCount, 2);
  assert.equal(naLista.lastMessage.text, 'Tudo bem?');
  assert.equal(naLista.lastMessage.fromMe, false);
  const listaCandidato = await json(await api('/api/conversas', { token: c.token }));
  assert.equal(listaCandidato.find((x: any) => x.id === conversa).unreadCount, 0);
  assert.equal(listaCandidato.find((x: any) => x.id === conversa).lastMessage.fromMe, true);

  // A empresa abre: vem em ordem cronológica, fromMe correto, e fica tudo lido.
  const lidas = await json(await msgs(e.token, conversa));
  assert.deepEqual(lidas.map((m: any) => [m.text, m.fromMe]), [['Olá!', false], ['Tudo bem?', false]]);
  const depois = await json(await api('/api/conversas', { token: e.token }));
  assert.equal(depois.find((x: any) => x.id === conversa).unreadCount, 0);

  // Ler as mensagens do outro não mexe nas minhas não lidas: a resposta da empresa conta para o candidato.
  await enviar(e.token, conversa, 'Oi, tudo!');
  assert.equal((await json(await api('/api/conversas', { token: c.token }))).find((x: any) => x.id === conversa).unreadCount, 1);
  assert.equal((await json(await api('/api/conversas', { token: e.token }))).find((x: any) => x.id === conversa).unreadCount, 0);
});

test('lista: conversa com mensagem mais recente vem primeiro', async () => {
  const c = await candidato();
  const a = await empresa();
  const b = await empresa();
  const ids: string[] = [];
  for (const emp of [a, b]) {
    await post(c.token, '/api/swipe', { postId: emp.vagaId, direction: 'like' });
    ids.push((await json(await post(emp.token, '/api/swipe', { postId: c.id, direction: 'like', vagaId: emp.vagaId }))).matchId);
  }
  assert.deepEqual((await json(await api('/api/conversas', { token: c.token }))).map((x: any) => x.id), [ids[1], ids[0]]);
  await enviar(c.token, ids[0], 'subiu');
  assert.deepEqual((await json(await api('/api/conversas', { token: c.token }))).map((x: any) => x.id), [ids[0], ids[1]]);
});

test('validação da mensagem: vazia e acima de 1000 → 400; exatamente 1000 passa', async () => {
  const { c, conversa } = await par();
  assert.equal((await enviar(c.token, conversa, '   ')).status, 400);
  assert.equal((await enviar(c.token, conversa, 123)).status, 400);
  assert.equal((await enviar(c.token, conversa, 'a'.repeat(1001))).status, 400);
  assert.equal((await enviar(c.token, conversa, 'a'.repeat(1000))).status, 201);
  assert.equal(await contar('SELECT count(*) FROM mensagem WHERE remetente_id = $1', [c.id]), 1);
});

test('quem não participa recebe 404 em todas as rotas, e nada muda', async () => {
  const { conversa } = await par();
  const intruso = await candidato();
  const t = intruso.token;
  const rotas: [string, string, unknown?][] = [
    ['GET', `/api/conversas/${conversa}`],
    ['GET', `/api/conversas/${conversa}/mensagens`],
    ['POST', `/api/conversas/${conversa}/mensagens`, { text: 'oi' }],
    ['DELETE', `/api/conversas/${conversa}`],
    ['POST', `/api/conversas/${conversa}/bloqueio`],
    ['POST', `/api/conversas/${conversa}/denuncia`, { reason: 'Spam ou propaganda' }],
    ['GET', '/api/conversas/999999999'], // inexistente: mesma resposta
  ];
  for (const [metodo, rota, corpo] of rotas) {
    assert.equal((await api(rota, { metodo, token: t, corpo })).status, 404, `${metodo} ${rota}`);
  }
  assert.deepEqual(await json(await api('/api/conversas', { token: t })), []);
  assert.equal(await contar('SELECT count(*) FROM match WHERE id = $1', [conversa]), 1);
  assert.equal(await contar('SELECT count(*) FROM bloqueio WHERE autor_id = $1', [intruso.id]), 0);
  assert.equal(await contar('SELECT count(*) FROM denuncia WHERE autor_id = $1', [intruso.id]), 0);
  assert.equal(await contar('SELECT count(*) FROM mensagem WHERE remetente_id = $1', [intruso.id]), 0);
});

test('desfazer match: some para os dois lados, apaga chat e mensagens, e o par não volta ao feed', async () => {
  const { c, e, conversa } = await par();
  await enviar(c.token, conversa, 'oi');
  assert.equal((await api(`/api/conversas/${conversa}`, { metodo: 'DELETE', token: e.token })).status, 204);
  for (const t of [c.token, e.token]) {
    assert.equal((await api(`/api/conversas/${conversa}`, { token: t })).status, 404);
    assert.deepEqual(await json(await api('/api/conversas', { token: t })), []);
  }
  assert.equal(await contar('SELECT count(*) FROM chat WHERE match_id = $1', [conversa]), 0);
  assert.equal(await contar('SELECT count(*) FROM mensagem WHERE remetente_id = $1', [c.id]), 0);
  assert.equal((await enviar(c.token, conversa, 'oi?')).status, 404);
  assert.equal((await api(`/api/conversas/${conversa}`, { metodo: 'DELETE', token: e.token })).status, 404);
});

test('bloquear: apaga o match, grava o bloqueio e o par não volta ao feed de nenhum lado', async () => {
  const { c, e, conversa } = await par();
  const feedC = async () => (await json(await api('/api/feed', { token: c.token }))).map((p: any) => p.id);
  const feedE = async () => (await json(await api(`/api/feed?vagaId=${e.vagaId}`, { token: e.token }))).map((p: any) => p.id);

  assert.equal((await post(c.token, `/api/conversas/${conversa}/bloqueio`, undefined)).status, 204);
  assert.equal(await contar('SELECT count(*) FROM match WHERE id = $1', [conversa]), 0);
  const { rows } = await pool.query('SELECT autor_id, alvo_id FROM bloqueio WHERE autor_id = $1', [c.id]);
  assert.deepEqual(rows, [{ autor_id: c.id, alvo_id: e.id }]);
  assert.ok(!(await feedC()).includes(e.vagaId));
  assert.ok(!(await feedE()).includes(String(c.id)));
  assert.equal((await api(`/api/conversas/${conversa}`, { token: e.token })).status, 404);

  // Mesmo fluxo com a empresa bloqueando: o alvo é o candidato.
  const outro = await par();
  assert.equal((await post(outro.e.token, `/api/conversas/${outro.conversa}/bloqueio`, undefined)).status, 204);
  const { rows: r2 } = await pool.query('SELECT alvo_id FROM bloqueio WHERE autor_id = $1', [outro.e.id]);
  assert.deepEqual(r2, [{ alvo_id: outro.c.id }]);
});

test('denúncia: motivo do front, a conversa continua, e a denúncia sobrevive ao fim do match', async () => {
  const { c, e, conversa } = await par();
  assert.equal((await post(c.token, `/api/conversas/${conversa}/denuncia`, { reason: 'Inventado' })).status, 400);
  assert.equal((await post(c.token, `/api/conversas/${conversa}/denuncia`, {})).status, 400);
  assert.equal((await post(c.token, `/api/conversas/${conversa}/denuncia`, { reason: 'Outro motivo', details: 'x'.repeat(1001) })).status, 400);

  assert.equal((await post(c.token, `/api/conversas/${conversa}/denuncia`, { reason: 'Spam ou propaganda', details: ' mandou propaganda ' })).status, 204);
  assert.equal((await post(e.token, `/api/conversas/${conversa}/denuncia`, { reason: 'Outro motivo' })).status, 204);
  assert.equal((await api(`/api/conversas/${conversa}`, { token: c.token })).status, 200); // denunciar não encerra

  const { rows } = await pool.query('SELECT autor_id, alvo_id, motivo, detalhes, match_id FROM denuncia WHERE autor_id IN ($1, $2) ORDER BY id', [c.id, e.id]);
  assert.deepEqual(rows, [
    { autor_id: c.id, alvo_id: e.id, motivo: 'Spam ou propaganda', detalhes: 'mandou propaganda', match_id: Number(conversa) },
    { autor_id: e.id, alvo_id: c.id, motivo: 'Outro motivo', detalhes: '', match_id: Number(conversa) },
  ]);

  await api(`/api/conversas/${conversa}`, { metodo: 'DELETE', token: c.token });
  assert.equal(await contar('SELECT count(*) FROM denuncia WHERE autor_id = $1', [c.id]), 1);
  assert.equal((await pool.query('SELECT match_id FROM denuncia WHERE autor_id = $1', [c.id])).rows[0].match_id, null);
});

test('bloqueio e unmatch não se desfazem repetindo o like pela API', async () => {
  const likes = (x: Awaited<ReturnType<typeof par>>, vagaId = x.e.vagaId) =>
    Promise.all([
      post(x.c.token, '/api/swipe', { postId: vagaId, direction: 'like' }).then(json),
      post(x.e.token, '/api/swipe', { postId: x.c.id, direction: 'like', vagaId }).then(json),
    ]);
  const matches = (candidatoId: number) => contar('SELECT count(*) FROM match WHERE candidato_id = $1', [candidatoId]);

  const desfeito = await par();
  await api(`/api/conversas/${desfeito.conversa}`, { metodo: 'DELETE', token: desfeito.c.token });
  assert.deepEqual(await likes(desfeito), [{ matched: false, matchId: null }, { matched: false, matchId: null }]);
  assert.equal(await matches(desfeito.c.id), 0);

  const bloqueado = await par();
  await post(bloqueado.c.token, `/api/conversas/${bloqueado.conversa}/bloqueio`, undefined);
  assert.deepEqual(await likes(bloqueado), [{ matched: false, matchId: null }, { matched: false, matchId: null }]);
  // Nem por outra vaga da mesma empresa: o bloqueio é entre as pessoas, não entre o par.
  const outraVaga = (await json(await post(bloqueado.e.token, '/api/vagas', vagaValida))).id as string;
  assert.deepEqual(await likes(bloqueado, outraVaga), [{ matched: false, matchId: null }, { matched: false, matchId: null }]);
  assert.equal(await matches(bloqueado.c.id), 0);
});

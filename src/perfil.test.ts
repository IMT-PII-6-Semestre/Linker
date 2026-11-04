import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { pastaUploads } from './config/env.js';
import { pool } from './db/pool.js';
import { candidatoValido, cep, usarServidor, vagaValida } from './test-helpers.js';

const { api, base } = usarServidor();

const login = async (email: string) =>
  ((await (await api('/api/auth/login', { metodo: 'POST', corpo: { email, senha: '123456', origin: 'mobile' } })).json()) as { token: string }).token;
const json = async (res: Response) => (await res.json()) as any;

test('GET /perfil: candidato com máscaras e datas dd/mm/aaaa', async () => {
  const res = await api('/api/perfil', { token: await login('ana@email.com') });
  assert.equal(res.status, 200);
  const p = await json(res);
  assert.equal(p.role, 'candidato');
  assert.equal(p.cpf, '529.982.247-25');
  assert.equal(p.dataNascimento, '10/05/2000');
  assert.equal(p.cep, '01310-100');
  assert.equal(p.fotoUri, null);
});

test('GET /perfil: empresa traz vagas[] com id string', async () => {
  const p = await json(await api('/api/perfil', { token: await login('rh@empresa.com') }));
  assert.equal(p.role, 'empresa');
  assert.equal(p.cnpj, '11.222.333/0001-81');
  assert.equal(p.vagas.length, 1);
  assert.equal(typeof p.vagas[0].id, 'string');
});

test('sem token → 401; admin → 403', async () => {
  assert.equal((await api('/api/perfil')).status, 401);
  const admin = await json(await api('/api/auth/login', { metodo: 'POST', corpo: { email: 'admin@linker.com', senha: '123456', origin: 'web' } }));
  assert.equal((await api('/api/perfil', { token: admin.token })).status, 403);
});

test('PUT /perfil edita e regeocodifica; e-mail de outro → 409', async () => {
  const email = `p${Date.now()}@teste.com`;
  const { token } = await json(await api('/api/auth/cadastro/candidato', { metodo: 'POST', corpo: candidatoValido(email) }));
  const { senha: _, ...edicao } = candidatoValido(email);

  const ok = await api('/api/perfil', { metodo: 'PUT', token, corpo: { ...edicao, cargoDesejado: 'Tech Lead' } });
  assert.equal(ok.status, 200);
  assert.equal((await json(ok)).cargoDesejado, 'Tech Lead');

  const dup = await api('/api/perfil', { metodo: 'PUT', token, corpo: { ...edicao, email: 'ana@email.com' } });
  assert.equal(dup.status, 409);
});

test('geocodificação fora do ar: o cadastro salva mesmo assim, sem cidade', async () => {
  cep.ok = false;
  try {
    const email = `g${Date.now()}@teste.com`;
    const res = await api('/api/auth/cadastro/candidato', { metodo: 'POST', corpo: candidatoValido(email) });
    assert.equal(res.status, 201);
    const { rows } = await pool.query(
      'SELECT p.cidade, p.lat FROM perfil_candidato p JOIN usuario u ON u.id = p.usuario_id WHERE u.email = $1', [email]);
    assert.deepEqual(rows[0], { cidade: null, lat: null });
  } finally {
    cep.ok = true;
  }
});

test('cadastro geocodifica o CEP', async () => {
  const email = `c${Date.now()}@teste.com`;
  await api('/api/auth/cadastro/candidato', { metodo: 'POST', corpo: candidatoValido(email) });
  const { rows } = await pool.query(
    'SELECT p.cidade, p.uf FROM perfil_candidato p JOIN usuario u ON u.id = p.usuario_id WHERE u.email = $1', [email]);
  assert.deepEqual(rows[0], { cidade: 'São Paulo', uf: 'SP' });
});

test('CRUD de vagas e posse', async () => {
  const alfa = await login('rh@empresa.com');
  const beta = await login('rh@empresabeta.com');

  const criada = await api('/api/vagas', { metodo: 'POST', token: alfa, corpo: vagaValida });
  assert.equal(criada.status, 201);
  const vaga = await json(criada);
  assert.equal(vaga.cargo, 'Dev Pleno');

  const editada = await api(`/api/vagas/${vaga.id}`, { metodo: 'PUT', token: alfa, corpo: { ...vagaValida, cargo: 'Dev Sênior' } });
  assert.equal((await json(editada)).cargo, 'Dev Sênior');

  // empresa errada → 403; inexistente → 404; candidato → 403
  assert.equal((await api(`/api/vagas/${vaga.id}`, { metodo: 'PUT', token: beta, corpo: vagaValida })).status, 403);
  assert.equal((await api(`/api/vagas/${vaga.id}`, { metodo: 'DELETE', token: beta })).status, 403);
  assert.equal((await api('/api/vagas/999999', { metodo: 'DELETE', token: alfa })).status, 404);
  assert.equal((await api('/api/vagas', { metodo: 'POST', token: await login('ana@email.com'), corpo: vagaValida })).status, 403);

  assert.equal((await api(`/api/vagas/${vaga.id}`, { metodo: 'DELETE', token: alfa })).status, 204);
  assert.equal((await api(`/api/vagas/${vaga.id}`, { metodo: 'DELETE', token: alfa })).status, 404);
});

test('PUT /perfil/foto grava em uploads/ e serve por /uploads', async () => {
  const token = await login('bruno@email.com');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  assert.equal((await api('/api/perfil/foto', { metodo: 'PUT', token, bruto: Buffer.from('x'), tipo: 'text/plain' })).status, 400);

  const res = await api('/api/perfil/foto', { metodo: 'PUT', token, bruto: png, tipo: 'image/png' });
  assert.equal(res.status, 200);
  const { fotoUri } = await json(res);
  assert.match(fotoUri, /^\/uploads\/.+\.png$/);
  assert.equal((await fetch(base() + fotoUri)).status, 200);
  await fs.rm(path.join(pastaUploads, path.basename(fotoUri)));
});

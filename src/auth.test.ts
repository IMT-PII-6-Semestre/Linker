import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

// Integração: usa as contas do seed (db/init/99-seed.sql).
let base = '';
const servidor = app.listen(0);
before(() => {
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`;
});
after(async () => {
  servidor.close();
  await pool.end();
});

const login = (email: string, origin: string) =>
  fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha: '123456', origin }),
  });
const me = (token: string) => fetch(base + '/auth/me', { headers: { authorization: `Bearer ${token}` } });

test('origem errada → 403, certa → 200', async () => {
  assert.equal((await login('admin@linker.com', 'mobile')).status, 403);
  assert.equal((await login('ana@email.com', 'web')).status, 403);
  assert.equal((await login('rh@empresa.com', 'web')).status, 403);
  assert.equal((await login('admin@linker.com', 'web')).status, 200);
  assert.equal((await login('ana@email.com', 'mobile')).status, 200);
});

test('origem inválida → 400', async () => {
  assert.equal((await login('ana@email.com', 'tv')).status, 400);
});

test('/me devolve o usuário do token', async () => {
  const { token } = (await (await login('ana@email.com', 'mobile')).json()) as { token: string };
  const res = await me(token);
  assert.equal(res.status, 200);
  const { usuario } = (await res.json()) as { usuario: { email: string; tipo: string } };
  assert.deepEqual([usuario.email, usuario.tipo], ['ana@email.com', 'candidato']);
});

test('token sem aud → 401; sem token → 401', async () => {
  const semAud = jwt.sign({ tipo: 'candidato' }, env.jwtSecret, { subject: '1' });
  assert.equal((await me(semAud)).status, 401);
  assert.equal((await fetch(base + '/auth/me')).status, 401);
});

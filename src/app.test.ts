import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { app } from './app.js';
import { pool } from './db/pool.js';

// Integração: precisa do Postgres do docker-compose (`docker compose up -d`).
let base = '';
const servidor = app.listen(0);
before(() => {
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`;
});
after(async () => {
  servidor.close();
  await pool.end();
});

const post = (rota: string, corpo: unknown) =>
  fetch(base + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

const candidato = (email: string) => ({
  nomeCompleto: 'Teste Silva', cpf: '529.982.247-25', dataNascimento: '10/05/2000', email,
  celular: '(11) 98765-4321', escolaridade: 'Médio', cargoDesejado: 'Dev', formacao: 'Curso',
  cep: '01310-100', tiposContrato: ['CLT'], experiencias: 'Nenhuma', anosExperiencia: 1,
  faixaSalarial: 'A combinar', hardSkills: ['SQL'], softSkills: ['Comunicação'],
  modalidades: ['Remoto'], senha: '123456',
});

test('cadastro, login e e-mail duplicado', async () => {
  const email = `t${Date.now()}@teste.com`;

  const cad = await post('/auth/cadastro/candidato', candidato(email));
  assert.equal(cad.status, 201);
  assert.ok(((await cad.json()) as { token?: string }).token);

  const ok = await post('/auth/login', { email, senha: '123456' });
  assert.equal(ok.status, 200);

  const ruim = await post('/auth/login', { email, senha: 'errada' });
  assert.equal(ruim.status, 401);

  const dup = await post('/auth/cadastro/candidato', candidato(email));
  assert.equal(dup.status, 409);
});

import type { AddressInfo } from 'node:net';
import { after, before } from 'node:test';
import { app } from './app.js';
import { pool } from './db/pool.js';

// Testes nunca batem na API de CEP de verdade: `cep.ok = false` simula a API fora do ar.
export const cep = { ok: true };
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (!String(url).includes('awesomeapi')) return fetchReal(url, init);
  if (!cep.ok) throw new Error('API de CEP fora do ar');
  return Response.json({ city: 'São Paulo', state: 'SP', lat: '-23.5632188', lng: '-46.6542596' });
}) as typeof fetch;

/** Sobe o app numa porta livre e devolve um `api()` já apontado para ela. */
export function usarServidor() {
  const servidor = app.listen(0);
  let base = '';
  before(() => {
    base = `http://localhost:${(servidor.address() as AddressInfo).port}`;
  });
  after(async () => {
    servidor.close();
    await pool.end();
  });
  return {
    api: (rota: string, opcoes: { metodo?: string; token?: string; corpo?: unknown; bruto?: Buffer; tipo?: string } = {}) =>
      fetch(base + rota, {
        method: opcoes.metodo ?? 'GET',
        headers: {
          ...(opcoes.token && { authorization: `Bearer ${opcoes.token}` }),
          ...(opcoes.corpo !== undefined && { 'content-type': 'application/json' }),
          ...(opcoes.tipo && { 'content-type': opcoes.tipo }),
        },
        body: opcoes.bruto ?? (opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined),
      }),
    base: () => base,
  };
}

export const candidatoValido = (email: string) => ({
  nomeCompleto: 'Teste Silva', cpf: '529.982.247-25', dataNascimento: '10/05/2000', email,
  celular: '(11) 98765-4321', escolaridade: 'Médio', cargoDesejado: 'Dev', formacao: 'Curso',
  cep: '01310-100', tiposContrato: ['CLT'], experiencias: 'Nenhuma', anosExperiencia: 1,
  faixaSalarial: 'A combinar', hardSkills: ['SQL'], softSkills: ['Comunicação'],
  modalidades: ['Remoto'], senha: '123456',
});

export const vagaValida = {
  cargo: 'Dev Pleno', descricao: 'APIs', beneficios: 'VR', horario: '9h às 18h', cep: '01310-100',
  skillsObrigatorias: ['Node.js'], skillsDesejaveis: [], experienciaMinima: 1, escolaridade: 'Médio',
  tipoContrato: 'CLT', faixaSalarial: 'A combinar', modalidade: 'Remoto',
};

export const empresaValida = (email: string) => ({
  cnpj: '11.222.333/0001-81', nomeEmpresa: 'Teste Ltda', dataFundacao: '15/03/2010',
  endereco: 'Av. Paulista, 1000', telefone: '(11) 3333-4444', email, senha: '123456',
  vaga: vagaValida,
});

/** Contas novas por teste (e-mail único), para os testes não dependerem do estado deixado por outros. */
export function fixtures(api: (rota: string, opcoes?: any) => Promise<Response>) {
  const json = async (res: Response) => (await res.json()) as any;
  let n = 0;
  const unico = () => `${Date.now()}${n++}`;
  return {
    async candidato(over: Record<string, unknown> = {}) {
      const corpo = await json(await api('/api/auth/cadastro/candidato', {
        metodo: 'POST', corpo: { ...candidatoValido(`c${unico()}@teste.com`), ...over },
      }));
      return { token: corpo.token as string, id: corpo.usuario.id as number };
    },
    /** Empresa nova; `vagaId` = a primeira vaga (do cadastro). */
    async empresa(vaga: Record<string, unknown> = {}) {
      const corpo = await json(await api('/api/auth/cadastro/empresa', {
        metodo: 'POST', corpo: { ...empresaValida(`e${unico()}@teste.com`), vaga: { ...vagaValida, ...vaga } },
      }));
      const token = corpo.token as string;
      const perfil = await json(await api('/api/perfil', { token }));
      return { token, id: corpo.usuario.id as number, vagaId: perfil.vagas[0].id as string };
    },
  };
}

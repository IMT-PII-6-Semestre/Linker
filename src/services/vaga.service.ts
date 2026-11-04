import { naoEncontrado, proibido } from '../errors/app-error.js';
import * as vagas from '../repositories/vaga.repository.js';
import type { EntradaVaga } from '../schemas/auth.schema.js';
import { emTransacao } from '../db/pool.js';
import { geocodificar } from './geocodificacao.service.js';
import { obterPerfil } from './perfil.service.js';

/** 404 se não existe, 403 se é de outra empresa. */
async function vagaDaEmpresa(vagaId: number, empresaId: number) {
  const vaga = await vagas.buscarVaga(vagaId);
  if (!vaga) throw naoEncontrado('Vaga não encontrada');
  if (vaga.empresaId !== empresaId) throw proibido('Esta vaga é de outra empresa');
  return vaga;
}

async function vagaPublica(vagaId: number, empresaId: number) {
  const perfil = await obterPerfil(empresaId, 'empresa');
  return perfil.role === 'empresa' && perfil.vagas.find((v) => v.id === String(vagaId))!;
}

export async function criarVaga(empresaId: number, entrada: EntradaVaga) {
  const local = await geocodificar(entrada.cep);
  const id = await emTransacao((cliente) => vagas.inserirVaga(cliente, empresaId, entrada, local));
  return vagaPublica(id, empresaId);
}

export async function editarVaga(vagaId: number, empresaId: number, entrada: EntradaVaga) {
  const atual = await vagaDaEmpresa(vagaId, empresaId);
  // Mesmo CEP → mantém a localização (ver perfil.service.ts).
  const local = atual.cep === entrada.cep ? null : await geocodificar(entrada.cep);
  await vagas.atualizarVaga(vagaId, entrada, local);
  return vagaPublica(vagaId, empresaId);
}

export async function removerVaga(vagaId: number, empresaId: number) {
  await vagaDaEmpresa(vagaId, empresaId);
  await vagas.excluirVaga(vagaId);
}

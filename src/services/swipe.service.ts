import { emTransacao } from '../db/pool.js';
import { naoEncontrado } from '../errors/app-error.js';
import * as feed from '../repositories/feed.repository.js';
import type { Lado } from '../repositories/feed.repository.js';
import * as vagas from '../repositories/vaga.repository.js';
import { vagaDaEmpresa } from './vaga.service.js';

/**
 * `postId` é o id do post do feed: a vaga (candidato) ou o candidato (empresa).
 * A empresa decide sempre em nome de uma vaga dela (`vagaId`); o 403 vem de `vagaDaEmpresa`.
 */
export async function registrarSwipe(
  usuario: { id: number; tipo: Lado },
  e: { postId: number; direction: 'like' | 'pass'; vagaId: number | null },
) {
  const autor = usuario.tipo;
  let candidatoId: number, vagaId: number, empresaId: number;
  if (autor === 'candidato') {
    const vaga = await vagas.buscarVaga(e.postId);
    if (!vaga) throw naoEncontrado('Vaga não encontrada');
    ({ empresaId } = vaga);
    candidatoId = usuario.id;
    vagaId = e.postId;
  } else {
    const vaga = await vagaDaEmpresa(e.vagaId!, usuario.id);
    if (!(await feed.candidatoExiste(e.postId))) throw naoEncontrado('Candidato não encontrado');
    empresaId = vaga.empresaId;
    candidatoId = e.postId;
    vagaId = e.vagaId!;
  }

  return emTransacao(async (cliente) => {
    await feed.travarPar(cliente, candidatoId, vagaId);
    const decisao = await feed.registrarSwipe(cliente, { candidatoId, vagaId, autor, direcao: e.direction });
    const outro: Lado = autor === 'candidato' ? 'empresa' : 'candidato';
    if (decisao !== 'like' || !(await feed.outroLadoCurtiu(cliente, candidatoId, vagaId, outro))) {
      return { matched: false, matchId: null };
    }
    return { matched: true, matchId: String(await feed.criarMatch(cliente, candidatoId, vagaId, empresaId)) };
  });
}

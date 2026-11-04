import { emTransacao, pool } from '../db/pool.js';
import { naoEncontrado } from '../errors/app-error.js';
import * as chat from '../repositories/chat.repository.js';
import type { Lado } from '../repositories/feed.repository.js';
import { paraPost } from './feed.service.js';

const naoExiste = () => naoEncontrado('Conversa não encontrada'); // também vale para quem não participa

/** `Message` do front: `sentAt` em epoch ms, `fromMe` calculado, status sempre `sent` (só há mensagens persistidas). */
function paraMensagem(l: Record<string, any>, matchId: number, eu: number) {
  return {
    id: String(l.id),
    conversationId: String(matchId),
    text: l.conteudo as string,
    sentAt: l.enviado_ms as number,
    fromMe: l.remetente_id === eu,
    status: 'sent' as const,
  };
}

/** `Conversation` do front. Quem vê o candidato enxerga a empresa e a vaga, e vice-versa. */
function paraConversa(l: Record<string, any>, eu: number) {
  const lado: Lado = l.candidato_id === eu ? 'candidato' : 'empresa';
  const matchId = l.match_id as number;
  const candidato = lado === 'candidato';
  return {
    id: String(matchId),
    participantName: (candidato ? l.empresa_nome : l.candidato_nome) as string,
    participantFotoUri: (candidato ? l.empresa_foto : l.candidato_foto) as string | null,
    subtitle: (candidato ? l.cargo : l.cargo_desejado) as string,
    post: paraPost(l, lado),
    lastMessage:
      l.ult_id == null
        ? null
        : paraMensagem({ id: l.ult_id, conteudo: l.ult_conteudo, enviado_ms: l.ult_enviado_ms, remetente_id: l.ult_remetente }, matchId, eu),
    unreadCount: l.nao_lidas as number,
  };
}

export async function listarConversas(eu: number) {
  return (await chat.conversas(eu, null)).map((l) => paraConversa(l, eu));
}

export async function obterConversa(eu: number, matchId: number) {
  const [linha] = await chat.conversas(eu, matchId);
  if (!linha) throw naoExiste();
  return paraConversa(linha, eu);
}

export async function listarMensagens(eu: number, matchId: number) {
  const chatId = await chat.chatDoParticipante(eu, matchId);
  if (chatId === null) throw naoExiste();
  await chat.marcarLidas(chatId, eu);
  return (await chat.mensagens(chatId)).map((l) => paraMensagem(l, matchId, eu));
}

export async function enviarMensagem(eu: number, matchId: number, texto: string) {
  const linha = await chat.inserirMensagem(matchId, eu, texto);
  if (!linha) throw naoExiste();
  return paraMensagem(linha, matchId, eu);
}

export async function desfazerMatch(eu: number, matchId: number) {
  if (!(await chat.excluirMatch(pool, matchId, eu))) throw naoExiste();
}

/** Bloquear = bloqueio + fim do match, juntos: o feed (fase 3) já esconde o par a partir do bloqueio. */
export async function bloquear(eu: number, matchId: number) {
  await emTransacao(async (cliente) => {
    const lados = await chat.excluirMatch(cliente, matchId, eu);
    if (!lados) throw naoExiste();
    await chat.inserirBloqueio(cliente, eu, lados.candidato_id === eu ? lados.empresa_id : lados.candidato_id);
  });
}

export async function denunciar(eu: number, matchId: number, motivo: string, detalhes: string) {
  if (!(await chat.inserirDenuncia(matchId, eu, motivo, detalhes))) throw naoExiste();
}
